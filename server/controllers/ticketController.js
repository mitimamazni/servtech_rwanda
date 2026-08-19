const pool = require('../config/db');
const { sendToClient } = require('../utils/notify');

const CATEGORIES = ['registration', 'betting', 'wallet', 'account', 'general'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// ── Client ────────────────────────────────────────────────────────────────

// Create a ticket + its opening message.
exports.createTicket = async (req, res) => {
  const { subject, category, priority, message } = req.body;
  if (!subject || !message) return res.status(400).json({ message: 'subject and message are required' });
  if (category && !CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid category' });
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ message: 'Invalid priority' });

  try {
    const clientResult = await pool.query(`SELECT id FROM clients WHERE user_id = $1`, [req.user.id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client profile not found' });
    const clientId = clientResult.rows[0].id;

    await pool.query('BEGIN');
    try {
      const ticketResult = await pool.query(
        `INSERT INTO support_tickets (client_id, subject, category, priority)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [clientId, subject, category || 'general', priority || 'normal']
      );
      const ticket = ticketResult.rows[0];

      await pool.query(
        `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message) VALUES ($1, $2, $3, $4)`,
        [ticket.id, req.user.id, 'client', message]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [req.user.id, clientId, 'CREATE_TICKET', `Opened ticket #${ticket.id}: ${subject}`]
      );

      await pool.query('COMMIT');

      // Confirmation email — best-effort, doesn't block the response. Same
      // graceful-skip behavior as the rest of the app: agent-registered
      // clients have no email on file and this just logs 'failed' for that.
      sendToClient({
        clientId,
        channel: 'email',
        subject: `We've received your ticket: ${subject}`,
        body: `Hi {first_name},\n\nThanks for reaching out. Your ticket "${subject}" (#${ticket.id}) has been received and a member of our team will respond shortly.\n\nYour message:\n"${message}"\n\n— ServTech Rwanda Support`,
        sentBy: req.user.id,
      }).catch(err => console.error('Ticket confirmation email failed:', err));

      res.status(201).json(ticket);
    } catch (txErr) {
      await pool.query('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// A client's own tickets, most recently updated first.
exports.getMyTickets = async (req, res) => {
  try {
    const clientResult = await pool.query(`SELECT id FROM clients WHERE user_id = $1`, [req.user.id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client profile not found' });

    const result = await pool.query(
      `SELECT t.*, (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count
       FROM support_tickets t WHERE t.client_id = $1 ORDER BY t.updated_at DESC`,
      [clientResult.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Admin / Agent ────────────────────────────────────────────────────────

// All tickets. Admin sees everything; agents see tickets for clients they
// registered, or tickets assigned to them — same scoping pattern used
// elsewhere in the app for agent visibility.
exports.getAllTickets = async (req, res) => {
  try {
    let query = `
      SELECT t.*, c.first_name, c.last_name, c.id_number, c.registered_by,
             u.name AS assigned_to_name,
             (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count
      FROM support_tickets t
      JOIN clients c ON t.client_id = c.id
      LEFT JOIN users u ON t.assigned_to = u.id`;
    const params = [];

    if (req.user.role === 'agent') {
      query += ` WHERE c.registered_by = $1 OR t.assigned_to = $1`;
      params.push(req.user.id);
    }
    query += ` ORDER BY
      CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
      t.updated_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Lightweight counts for the admin dashboard — same agent-scoping as getAllTickets.
exports.getTicketStats = async (req, res) => {
  try {
    let query = `
      SELECT
        COUNT(*) FILTER (WHERE t.status = 'open') AS open,
        COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress,
        COUNT(*) AS total
      FROM support_tickets t
      JOIN clients c ON t.client_id = c.id`;
    const params = [];
    if (req.user.role === 'agent') {
      query += ` WHERE c.registered_by = $1 OR t.assigned_to = $1`;
      params.push(req.user.id);
    }
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Shared (ownership/scope checked per role) ───────────────────────────

const canAccessTicket = async (req, ticket) => {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'client') {
    const clientResult = await pool.query(`SELECT id FROM clients WHERE user_id = $1`, [req.user.id]);
    return clientResult.rows[0]?.id === ticket.client_id;
  }
  if (req.user.role === 'agent') {
    const clientResult = await pool.query(`SELECT registered_by FROM clients WHERE id = $1`, [ticket.client_id]);
    return clientResult.rows[0]?.registered_by === req.user.id || ticket.assigned_to === req.user.id;
  }
  return false;
};

exports.getTicket = async (req, res) => {
  try {
    const ticketResult = await pool.query(
      `SELECT t.*, c.first_name, c.last_name, c.id_number, u.name AS assigned_to_name
       FROM support_tickets t
       JOIN clients c ON t.client_id = c.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (ticketResult.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });
    const ticket = ticketResult.rows[0];

    if (!(await canAccessTicket(req, ticket))) return res.status(403).json({ message: 'Access denied' });

    const messages = await pool.query(
      `SELECT m.*, u.name AS sender_name FROM ticket_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
      [req.params.id]
    );

    res.json({ ticket, messages: messages.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addMessage = async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ message: 'message is required' });

  try {
    const ticketResult = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [req.params.id]);
    if (ticketResult.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });
    const ticket = ticketResult.rows[0];

    if (!(await canAccessTicket(req, ticket))) return res.status(403).json({ message: 'Access denied' });
    if (ticket.status === 'closed') return res.status(400).json({ message: 'This ticket is closed' });

    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message) VALUES ($1, $2, $3, $4)`,
      [ticket.id, req.user.id, req.user.role, message.trim()]
    );

    // Staff replying to an open ticket moves it into progress automatically.
    const nextStatus = (req.user.role !== 'client' && ticket.status === 'open') ? 'in_progress' : ticket.status;
    await pool.query(`UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2`, [nextStatus, ticket.id]);

    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, ticket.client_id, 'TICKET_REPLY', `Replied to ticket #${ticket.id}`]
    );

    // Notify the client by email when staff (not the client themselves) reply.
    if (req.user.role !== 'client') {
      sendToClient({
        clientId: ticket.client_id,
        channel: 'email',
        subject: `New reply on your ticket: ${ticket.subject}`,
        body: `Hi {first_name},\n\nYou have a new reply on your support ticket "${ticket.subject}" (#${ticket.id}):\n\n"${message.trim()}"\n\nLog in to your ServTech Rwanda account to continue the conversation.\n\n— ServTech Rwanda Support`,
        sentBy: req.user.id,
      }).catch(err => console.error('Ticket reply email failed:', err));
    }

    res.status(201).json({ message: 'Reply added', status: nextStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  try {
    const ticketResult = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [req.params.id]);
    if (ticketResult.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });
    const ticket = ticketResult.rows[0];

    if (!(await canAccessTicket(req, ticket)) || req.user.role === 'client') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.query(`UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2`, [status, req.params.id]);
    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, ticket.client_id, 'TICKET_STATUS', `Ticket #${ticket.id} status → ${status}`]
    );

    if (status === 'resolved') {
      sendToClient({
        clientId: ticket.client_id,
        channel: 'email',
        subject: `Your ticket has been resolved: ${ticket.subject}`,
        body: `Hi {first_name},\n\nYour support ticket "${ticket.subject}" (#${ticket.id}) has been marked as resolved. If the issue isn't fully sorted, just reply on the ticket and we'll reopen it.\n\n— ServTech Rwanda Support`,
        sentBy: req.user.id,
      }).catch(err => console.error('Ticket resolved email failed:', err));
    }

    res.json({ status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin-only reassignment.
exports.assignTicket = async (req, res) => {
  const { agent_id } = req.body;
  try {
    const ticketResult = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [req.params.id]);
    if (ticketResult.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });

    if (agent_id) {
      const agentResult = await pool.query(`SELECT id, role FROM users WHERE id = $1`, [agent_id]);
      if (agentResult.rows.length === 0 || !['admin', 'agent'].includes(agentResult.rows[0].role)) {
        return res.status(400).json({ message: 'agent_id must be a valid admin or agent user' });
      }
    }

    await pool.query(`UPDATE support_tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2`, [agent_id || null, req.params.id]);
    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, ticketResult.rows[0].client_id, 'TICKET_ASSIGN', `Ticket #${req.params.id} assigned to user ${agent_id || 'unassigned'}`]
    );

    res.json({ message: 'Ticket reassigned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
