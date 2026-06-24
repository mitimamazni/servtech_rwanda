const pool = require('../config/db');

// Age check from Rwanda ID format: positions 1-4 = birth year
const getAgeFromId = (id_number) => {
  const birthYear = parseInt(id_number.substring(1, 5));
  return new Date().getFullYear() - birthYear;
};

exports.verifyId = async (req, res) => {
  const { id_number } = req.body;
  try {
    // Age gate
    const age = getAgeFromId(id_number);
    if (age < 18) {
      return res.status(400).json({
        verified: false,
        underAge: true,
        message: `Registration denied. This person is approximately ${age} years old. Minimum age is 18.`,
      });
    }

    const result = await pool.query(
      'SELECT * FROM id_records WHERE id_number = $1 AND valid = true',
      [id_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ verified: false, message: 'ID not found in national registry' });
    }

    const record = result.rows[0];
    res.json({
      verified: true,
      data: {
        id_number: record.id_number,
        first_name: record.first_name,
        last_name: record.last_name,
        date_of_birth: record.date_of_birth,
        gender: record.gender,
        district: record.district,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.registerClient = async (req, res) => {
  const { id_number, first_name, last_name, date_of_birth, gender, phone, district } = req.body;

  try {
    // Age gate
    const age = getAgeFromId(id_number);
    if (age < 18) {
      return res.status(400).json({
        message: `Registration denied. This person is approximately ${age} years old. Minimum age is 18.`,
        underAge: true,
      });
    }

    // Duplicate check
    const existing = await pool.query('SELECT id, status FROM clients WHERE id_number = $1', [id_number]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        message: 'This ID is already registered on ServTech Rwanda.',
        duplicate: true,
        existingStatus: existing.rows[0].status,
      });
    }

    const idCheck = await pool.query('SELECT id FROM id_records WHERE id_number = $1 AND valid = true', [id_number]);
    const status = idCheck.rows.length > 0 ? 'verified' : 'pending';

    const result = await pool.query(
      `INSERT INTO clients (id_number, first_name, last_name, date_of_birth, gender, phone, district, status, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id_number, first_name, last_name, date_of_birth, gender, phone, district, status, req.user.id]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'REGISTER_CLIENT', `Registered client ${id_number} - status: ${status}`]
    );

    res.status(201).json({ message: 'Client registered successfully', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getClients = async (req, res) => {
  const { search, status, page = 1 } = req.query;
  const limit = 10;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT c.*, u.name as agent_name, u.phone as agent_phone, u.email as agent_email
      FROM clients c
      LEFT JOIN users u ON c.registered_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.id_number ILIKE $${params.length})`;
    }
    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    // Agents only see their own clients
    if (req.user.role === 'agent') {
      params.push(req.user.id);
      query += ` AND c.registered_by = $${params.length}`;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM clients c WHERE 1=1`;
    const countParams = [];
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (c.first_name ILIKE $${countParams.length} OR c.last_name ILIKE $${countParams.length} OR c.id_number ILIKE $${countParams.length})`;
    }
    if (status) { countParams.push(status); countQuery += ` AND c.status = $${countParams.length}`; }
    if (req.user.role === 'agent') { countParams.push(req.user.id); countQuery += ` AND c.registered_by = $${countParams.length}`; }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      clients: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    let where = '';
    const params = [];
    if (req.user.role === 'agent') {
      params.push(req.user.id);
      where = ` WHERE registered_by = $1`;
    }

    const total    = await pool.query(`SELECT COUNT(*) FROM clients${where}`, params);
    const verified = await pool.query(`SELECT COUNT(*) FROM clients${where}${where ? ' AND' : ' WHERE'} status = 'verified'`, params);
    const pending  = await pool.query(`SELECT COUNT(*) FROM clients${where}${where ? ' AND' : ' WHERE'} status = 'pending'`, params);
    const today    = await pool.query(`SELECT COUNT(*) FROM clients${where}${where ? ' AND' : ' WHERE'} created_at::date = CURRENT_DATE`, params);

    res.json({
      total:    parseInt(total.rows[0].count),
      verified: parseInt(verified.rows[0].count),
      pending:  parseInt(pending.rows[0].count),
      today:    parseInt(today.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
