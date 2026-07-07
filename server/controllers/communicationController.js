const pool = require('../config/db');
const { sendToClient } = require('../utils/notify');

exports.getTemplates = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM message_templates ORDER BY created_at DESC');
    res.json({ templates: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTemplate = async (req, res) => {
  const { name, channel, subject, body } = req.body;
  if (!name || !channel || !body) return res.status(400).json({ message: 'name, channel, and body are required' });
  if (!['email', 'sms'].includes(channel)) return res.status(400).json({ message: 'channel must be email or sms' });
  try {
    const result = await pool.query(
      `INSERT INTO message_templates (name, channel, subject, body, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, channel, channel === 'email' ? subject : null, body, req.user.id]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateTemplate = async (req, res) => {
  const { id } = req.params;
  const { name, subject, body } = req.body;
  try {
    const result = await pool.query(
      `UPDATE message_templates SET name = COALESCE($1, name), subject = COALESCE($2, subject), body = COALESCE($3, body)
       WHERE id = $4 RETURNING *`,
      [name, subject, body, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Template not found' });
    res.json({ template: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteTemplate = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM message_templates WHERE id = $1', [id]);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Paginated communication history — the "Communication history log" UI element.
exports.getMessageLog = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT m.id, m.channel, m.recipient, m.subject, m.body, m.status, m.created_at,
              c.first_name, c.last_name, c.id_number, u.name as sent_by_name
       FROM message_log m
       LEFT JOIN clients c ON m.client_id = c.id
       LEFT JOIN users u ON m.sent_by = u.id
       ORDER BY m.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Bulk messaging — send to many clients at once, either from a template or
// free-text, over email (real) or SMS (mocked — see utils/notify.js).
// Opt-out clients are automatically skipped (and still logged as such).
exports.sendBulkMessage = async (req, res) => {
  const { clientIds, channel, templateId, subject, body } = req.body;

  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return res.status(400).json({ message: 'clientIds must be a non-empty array' });
  }
  if (!['email', 'sms'].includes(channel)) {
    return res.status(400).json({ message: 'channel must be email or sms' });
  }

  try {
    let finalSubject = subject;
    let finalBody = body;

    if (templateId) {
      const template = await pool.query('SELECT * FROM message_templates WHERE id = $1', [templateId]);
      if (template.rows.length === 0) return res.status(404).json({ message: 'Template not found' });
      finalSubject = template.rows[0].subject;
      finalBody = template.rows[0].body;
    }

    if (!finalBody) return res.status(400).json({ message: 'Message body is required (or pick a template)' });

    const results = await Promise.all(
      clientIds.map(clientId =>
        sendToClient({ clientId, channel, subject: finalSubject, body: finalBody, templateId: templateId || null, sentBy: req.user.id })
      )
    );

    const summary = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'BULK_MESSAGE', `Sent ${channel} to ${clientIds.length} client(s) — ${JSON.stringify(summary)}`]
    );

    res.json({ message: 'Bulk send complete', summary, total: clientIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
