const pool = require('../config/db');

exports.getAuditLogs = async (req, res) => {
  const { page = 1, action, user_id } = req.query;
  const limit = 15;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT a.*, u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      params.push(action);
      query += ` AND a.action = $${params.length}`;
    }

    if (user_id) {
      params.push(user_id);
      query += ` AND a.user_id = $${params.length}`;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (action) {
      countParams.push(action);
      countQuery += ` AND action = $${countParams.length}`;
    }

    if (user_id) {
      countParams.push(user_id);
      countQuery += ` AND user_id = $${countParams.length}`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, role FROM users ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
