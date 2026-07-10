const pool = require('../config/db');
const { sendRawEmail } = require('./email');

// Fills {first_name}, {last_name}, {id_number}, {rejection_reason} placeholders
// found in a template body/subject using the client's own data.
const resolvePlaceholders = (text, client) => {
  if (!text) return text;
  return text
    .replace(/{first_name}/g, client.first_name || '')
    .replace(/{last_name}/g, client.last_name || '')
    .replace(/{id_number}/g, client.id_number || '')
    .replace(/{rejection_reason}/g, client.rejection_reason || 'not specified');
};

// MOCK SMS SEND — for demo/defense purposes. A production system would call
// a real gateway (e.g. Africa's Talking, Twilio) here. We just log the
// message as sent, unless there's no phone number on file to send it to.
const mockSendSms = async (phone, body) => {
  if (!phone) return { success: false, reason: 'No phone number on file' };
  console.log(`[mock-sms] → ${phone}: ${body}`);
  return { success: true };
};

// Sends a single message to a client over email or SMS, resolving template
// placeholders, respecting opt-in/opt-out, and logging every attempt
// (sent, failed, or skipped) to message_log for the communication history view.
const sendToClient = async ({ clientId, channel, subject, body, templateId = null, sentBy = null }) => {
  const clientResult = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.id_number, c.phone, c.rejection_reason,
            c.sms_opt_in, c.email_opt_in, u.email
     FROM clients c LEFT JOIN users u ON c.user_id = u.id
     WHERE c.id = $1`,
    [clientId]
  );
  if (clientResult.rows.length === 0) return { status: 'failed', reason: 'Client not found' };
  const client = clientResult.rows[0];

  const optedIn = channel === 'sms' ? client.sms_opt_in : client.email_opt_in;
  const resolvedBody = resolvePlaceholders(body, client);
  const resolvedSubject = channel === 'email' ? resolvePlaceholders(subject, client) : null;
  const recipient = channel === 'sms' ? (client.phone || 'unknown') : (client.email || 'unknown');

  let status;
  let errorDetail = null;
  if (!optedIn) {
    status = 'skipped_opt_out';
  } else if (channel === 'sms') {
    const result = await mockSendSms(client.phone, resolvedBody);
    status = result.success ? 'sent' : 'failed';
    if (!result.success) errorDetail = result.reason || 'SMS send failed';
  } else {
    if (!client.email) {
      // Agent-registered clients (the common case) never get a login/email
      // account created for them, so there's simply no address to send to —
      // this is not a misconfiguration, it's expected for most client records.
      status = 'failed';
      errorDetail = 'No email on file for this client (only self-registered clients have one)';
    } else {
      const result = await sendRawEmail(client.email, resolvedSubject, resolvedBody);
      status = result?.success ? 'sent' : 'failed';
      if (!result?.success) errorDetail = result?.reason || 'Email send failed';
    }
  }

  await pool.query(
    `INSERT INTO message_log (client_id, sent_by, channel, template_id, recipient, subject, body, status, error_detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [clientId, sentBy, channel, templateId, recipient, resolvedSubject, resolvedBody, status, errorDetail]
  );

  return { status, recipient, errorDetail };
};

module.exports = { sendToClient, resolvePlaceholders };
