const pool = require('../config/db');

// Fires every enabled webhook registered for a given trigger event, in
// parallel, each with its own timeout so one slow/dead endpoint can't block
// the others or the request that triggered it. Every attempt (success or
// failure) is logged to webhook_delivery_log for the admin-facing delivery view.
//
// This is genuinely functional — it makes a real outbound HTTP POST — but
// there's no real external compliance/SMS/Slack system to point it at in this
// project, so in practice an admin would aim it at something like
// https://webhook.site during a demo, or a real endpoint in production.
const WEBHOOK_TIMEOUT_MS = 8000;

const fireWebhooks = async (triggerEvent, payload, clientId = null) => {
  try {
    const result = await pool.query(
      'SELECT * FROM webhook_integrations WHERE trigger_event = $1 AND enabled = true',
      [triggerEvent]
    );
    if (result.rows.length === 0) return;

    await Promise.all(result.rows.map(async (hook) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
      try {
        const res = await fetch(hook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: triggerEvent, ...payload }),
          signal: controller.signal,
        });
        await pool.query(
          'INSERT INTO webhook_delivery_log (webhook_id, client_id, status, status_code) VALUES ($1, $2, $3, $4)',
          [hook.id, clientId, res.ok ? 'sent' : 'failed', res.status]
        );
      } catch (err) {
        await pool.query(
          'INSERT INTO webhook_delivery_log (webhook_id, client_id, status, error_detail) VALUES ($1, $2, $3, $4)',
          [hook.id, clientId, 'failed', err.name === 'AbortError' ? 'Request timed out' : err.message]
        );
      } finally {
        clearTimeout(timeout);
      }
    }));
  } catch (err) {
    // Webhook delivery is best-effort and must never break the calling flow
    // (registration, KYC review, etc.) — log and move on.
    console.error('Webhook dispatch error:', err);
  }
};

module.exports = { fireWebhooks };
