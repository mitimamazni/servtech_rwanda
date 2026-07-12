const pool = require('../config/db');
const { fireWebhooks } = require('../utils/webhooks');
const { sendRawEmail } = require('../utils/email');

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

// ── Step configuration panel: per-rule parameters + canvas layout ──────────

// Updates a rule's configurable parameters (e.g. { threshold: 60 }) and/or
// description — this is what the visual designer's side panel writes to.
exports.updateRuleConfig = async (req, res) => {
  const { id } = req.params;
  const { config, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE automation_rules SET
         config = COALESCE($1, config),
         description = COALESCE($2, description)
       WHERE id = $3 RETURNING *`,
      [config ? JSON.stringify(config) : null, description, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Rule not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CONFIGURE_AUTOMATION_RULE', `Updated configuration for rule: ${result.rows[0].name}`]
    );

    res.json({ rule: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Batch-saves node positions dragged on the visual flow canvas.
exports.saveRulePositions = async (req, res) => {
  const { positions } = req.body;
  if (!Array.isArray(positions)) return res.status(400).json({ message: 'positions must be an array' });
  try {
    await Promise.all(
      positions.map(p => pool.query(
        'UPDATE automation_rules SET position_x = $1, position_y = $2 WHERE id = $3',
        [p.position_x, p.position_y, p.id]
      ))
    );
    res.json({ message: 'Layout saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Escalation rules ─────────────────────────────────────────────────────

exports.getEscalationRules = async (req, res) => {
  try {
    const rules = await pool.query('SELECT * FROM escalation_rules ORDER BY created_at ASC');
    const recent = await pool.query(
      `SELECT el.id, el.hours_pending, el.created_at, er.name AS rule_name,
              c.id AS client_id, c.first_name, c.last_name, c.id_number
       FROM escalation_log el
       JOIN escalation_rules er ON el.escalation_rule_id = er.id
       JOIN clients c ON el.client_id = c.id
       ORDER BY el.created_at DESC LIMIT 50`
    );
    res.json({ rules: rules.rows, recent: recent.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createEscalationRule = async (req, res) => {
  const { name, condition_status, threshold_hours, notify_role } = req.body;
  if (!name || !threshold_hours) return res.status(400).json({ message: 'name and threshold_hours are required' });
  try {
    const result = await pool.query(
      `INSERT INTO escalation_rules (name, condition_status, threshold_hours, notify_role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, condition_status || 'pending', threshold_hours, notify_role || 'admin']
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateEscalationRule = async (req, res) => {
  const { id } = req.params;
  const { name, condition_status, threshold_hours, notify_role } = req.body;
  try {
    const result = await pool.query(
      `UPDATE escalation_rules SET
         name = COALESCE($1, name), condition_status = COALESCE($2, condition_status),
         threshold_hours = COALESCE($3, threshold_hours), notify_role = COALESCE($4, notify_role)
       WHERE id = $5 RETURNING *`,
      [name, condition_status, threshold_hours, notify_role, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Escalation rule not found' });
    res.json({ rule: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleEscalationRule = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('UPDATE escalation_rules SET enabled = NOT enabled WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Escalation rule not found' });
    res.json({ rule: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteEscalationRule = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM escalation_rules WHERE id = $1', [id]);
    res.json({ message: 'Escalation rule deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Runs every enabled escalation rule now: finds clients matching the rule's
// status that have been sitting that way longer than threshold_hours and
// haven't already been logged for this rule, logs them, fires the
// 'escalation' webhook event, and emails whoever holds notify_role.
// Triggered on-demand (button in the UI) rather than a real cron job, since
// this environment has no background scheduler — an admin visiting the
// automation page and clicking "Check now" is the trigger.
exports.runEscalationCheck = async (req, res) => {
  try {
    const rulesResult = await pool.query('SELECT * FROM escalation_rules WHERE enabled = true');
    let totalEscalated = 0;

    for (const rule of rulesResult.rows) {
      const statusColumn = rule.condition_status === 'pending' ? 'kyc_submitted_at' : 'created_at';
      const overdueResult = await pool.query(
        `SELECT c.id, c.first_name, c.last_name, c.id_number,
                EXTRACT(EPOCH FROM (NOW() - c.${statusColumn})) / 3600 AS hours_pending
         FROM clients c
         WHERE c.status = $1
           AND c.${statusColumn} < NOW() - ($2 || ' hours')::interval
           AND NOT EXISTS (
             SELECT 1 FROM escalation_log el WHERE el.escalation_rule_id = $3 AND el.client_id = c.id
           )`,
        [rule.condition_status, rule.threshold_hours, rule.id]
      );

      for (const client of overdueResult.rows) {
        await pool.query(
          'INSERT INTO escalation_log (escalation_rule_id, client_id, hours_pending) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [rule.id, client.id, client.hours_pending]
        );
        await pool.query(
          'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
          [null, client.id, 'ESCALATED', `Escalated by rule "${rule.name}": ${client.id_number} has been ${rule.condition_status} for ${Math.round(client.hours_pending)}h (threshold ${rule.threshold_hours}h)`]
        );
      }

      if (overdueResult.rows.length > 0) {
        totalEscalated += overdueResult.rows.length;
        fireWebhooks('escalation', {
          ruleName: rule.name, count: overdueResult.rows.length,
          clientIds: overdueResult.rows.map(c => c.id),
        });

        const notifyUsers = await pool.query('SELECT email, name FROM users WHERE role = $1 AND status = $2', [rule.notify_role, 'active']);
        const listText = overdueResult.rows.map(c => `- ${c.first_name} ${c.last_name} (${c.id_number}) — pending ${Math.round(c.hours_pending)}h`).join('\n');
        await Promise.all(notifyUsers.rows.map(u =>
          sendRawEmail(u.email, `ServTech Rwanda: ${overdueResult.rows.length} client(s) need review`,
            `Hello ${u.name},\n\nThe escalation rule "${rule.name}" found ${overdueResult.rows.length} client(s) that have been ${rule.condition_status} for longer than ${rule.threshold_hours} hours:\n\n${listText}\n\nPlease review them in the admin dashboard.`)
            .catch(() => {}) // best-effort — a notification failure shouldn't fail the whole check
        ));
      }
    }

    res.json({ message: totalEscalated > 0 ? `${totalEscalated} client(s) escalated` : 'No clients currently exceed any escalation threshold', escalated: totalEscalated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Approval chains ──────────────────────────────────────────────────────

exports.getApprovalChains = async (req, res) => {
  try {
    const chains = await pool.query('SELECT * FROM approval_chains ORDER BY created_at ASC');
    const steps = await pool.query('SELECT * FROM approval_chain_steps ORDER BY chain_id, step_order ASC');
    const chainsWithSteps = chains.rows.map(chain => ({
      ...chain,
      steps: steps.rows.filter(s => s.chain_id === chain.id),
    }));
    res.json({ chains: chainsWithSteps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleApprovalChain = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('UPDATE approval_chains SET enabled = NOT enabled WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Approval chain not found' });
    res.json({ chain: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Replaces a chain's full step list in one call — simplest way to support
// add/remove/reorder/relabel from a single "Save steps" action in the UI.
exports.updateApprovalChainSteps = async (req, res) => {
  const { id } = req.params;
  const { steps } = req.body;
  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ message: 'At least one step is required' });
  }
  try {
    await pool.query('DELETE FROM approval_chain_steps WHERE chain_id = $1', [id]);
    const inserted = await Promise.all(steps.map((s, i) =>
      pool.query(
        'INSERT INTO approval_chain_steps (chain_id, step_order, required_role, label) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, i + 1, s.required_role || 'admin', s.label || `Step ${i + 1}`]
      )
    ));

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CONFIGURE_APPROVAL_CHAIN', `Updated approval chain #${id} to ${steps.length} step(s)`]
    );

    res.json({ steps: inserted.map(r => r.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Webhook integrations (external service integrations) ────────────────

exports.getWebhooks = async (req, res) => {
  try {
    const webhooks = await pool.query('SELECT * FROM webhook_integrations ORDER BY created_at ASC');
    const log = await pool.query(
      `SELECT wl.id, wl.status, wl.status_code, wl.error_detail, wl.created_at,
              w.name AS webhook_name, c.id_number
       FROM webhook_delivery_log wl
       JOIN webhook_integrations w ON wl.webhook_id = w.id
       LEFT JOIN clients c ON wl.client_id = c.id
       ORDER BY wl.created_at DESC LIMIT 50`
    );
    res.json({ webhooks: webhooks.rows, log: log.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createWebhook = async (req, res) => {
  const { name, url, trigger_event } = req.body;
  if (!name || !url) return res.status(400).json({ message: 'name and url are required' });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ message: 'url must start with http:// or https://' });
  try {
    const result = await pool.query(
      'INSERT INTO webhook_integrations (name, url, trigger_event) VALUES ($1, $2, $3) RETURNING *',
      [name, url, trigger_event || 'client_registered']
    );
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_WEBHOOK', `Created webhook integration "${name}" for event ${trigger_event || 'client_registered'}`]
    );
    res.status(201).json({ webhook: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleWebhook = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('UPDATE webhook_integrations SET enabled = NOT enabled WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ webhook: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteWebhook = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM webhook_integrations WHERE id = $1', [id]);
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
