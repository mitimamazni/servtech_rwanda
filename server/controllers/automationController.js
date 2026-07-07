const pool = require('../config/db');

exports.getRules = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM automation_rules ORDER BY sort_order ASC');
    res.json({ rules: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleRule = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE automation_rules SET enabled = NOT enabled WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Rule not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'TOGGLE_AUTOMATION_RULE', `${result.rows[0].enabled ? 'Enabled' : 'Disabled'} rule: ${result.rows[0].name}`]
    );

    res.json({ rule: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Drag-and-drop reordering — accepts the new order as an array of rule IDs.
exports.reorderRules = async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ message: 'orderedIds must be an array' });
  try {
    await Promise.all(
      orderedIds.map((id, index) => pool.query('UPDATE automation_rules SET sort_order = $1 WHERE id = $2', [index, id]))
    );
    const result = await pool.query('SELECT * FROM automation_rules ORDER BY sort_order ASC');
    res.json({ rules: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getExecutionLog = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT w.id, w.rule_code, w.rule_name, w.client_id, w.result_summary, w.created_at,
              c.first_name, c.last_name, c.id_number
       FROM workflow_execution_log w
       LEFT JOIN clients c ON w.client_id = c.id
       ORDER BY w.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ log: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
