const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { sendClientWelcomeEmail } = require('../utils/email');
const { validateImageDataUrl } = require('../utils/kyc');
const { runRegistrationWorkflow, runReviewWorkflow } = require('../utils/workflowEngine');
const { sendToClient } = require('../utils/notify');
const { verifyChallenge } = require('../utils/captcha');

const MIN_AGE = 18;
const ELDERLY_AGE = 80;

const yearMismatch = (id_number, date_of_birth) => {
  if (!id_number || !date_of_birth || id_number.length < 5) return false;
  const idYear = parseInt(id_number.substring(1, 5));
  const dobYear = new Date(date_of_birth).getFullYear();
  if (Number.isNaN(idYear) || Number.isNaN(dobYear)) return false;
  return idYear !== dobYear;
};

// Column list used whenever a client row is returned to the frontend, so
// large base64 KYC image blobs never ride along in list/action responses.
const SAFE_CLIENT_COLUMNS = `
  id, user_id, id_number, first_name, last_name, date_of_birth, gender, phone,
  district, status, rejection_reason, is_active, elderly_assisted, registered_by,
  wallet_balance, created_at, kyc_submitted_at,
  face_match_score, document_authenticity_score, sanctions_flag, sanctions_match_name,
  sms_opt_in, email_opt_in, approval_chain_id, approval_step_index,
  (selfie_data IS NOT NULL) AS has_selfie,
  (id_document_data IS NOT NULL) AS has_id_document
`;

// Client self-registration
exports.selfRegister = async (req, res) => {
  const { id_number, first_name, last_name, date_of_birth, gender, phone, district, email, selfie_data, id_document_data, captcha_token, captcha_answer, terms_accepted, terms_version } = req.body;

  try {
    const captchaError = verifyChallenge(captcha_token, captcha_answer);
    if (captchaError) return res.status(400).json({ message: captchaError });

    // Server-side gate on Terms & Conditions acceptance — the frontend
    // disables the submit button until this is checked, but that alone is
    // trivially bypassable, so it's enforced here too.
    if (!terms_accepted) {
      return res.status(400).json({ message: 'You must agree to the Terms & Conditions to register.' });
    }

    // Duplicate client check — a previously *rejected* attempt (e.g. the person was
    // under 18 at the time) should not permanently block a legitimate later attempt,
    // so only an active (pending/verified) record counts as a real duplicate.
    const existingClient = await pool.query(
      "SELECT id, status FROM clients WHERE id_number = $1 AND status != 'rejected'",
      [id_number]
    );
    if (existingClient.rows.length > 0) {
      return res.status(400).json({
        message: 'This ID is already registered on ServTech Rwanda.',
        duplicate: true,
      });
    }

    // Age check from ID number format: positions 1-4 = birth year
    const birthYear = parseInt(id_number.substring(1, 5));
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    // Under 18 or over 80 via self-service: record the attempt as a rejected
    // client (no login account is created) so it's visible to admins under the
    // "Rejected" filter, and direct the person to an agent for assisted registration.
    if (age < MIN_AGE || age > ELDERLY_AGE) {
      const reason = age < MIN_AGE
        ? `Under ${MIN_AGE} - minimum registration age not met (approx. age ${age})`
        : `Over ${ELDERLY_AGE} - self-service registration requires agent-assisted identity confirmation (approx. age ${age})`;

      // Upsert: replaces any earlier rejected attempt for the same ID number
      // instead of failing on the unique id_number constraint.
      const rejectedResult = await pool.query(
        `INSERT INTO clients (id_number, first_name, last_name, date_of_birth, gender, phone, district, status, rejection_reason, registered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'rejected', $8, NULL)
         ON CONFLICT (id_number) DO UPDATE SET
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
           date_of_birth = EXCLUDED.date_of_birth, gender = EXCLUDED.gender,
           phone = EXCLUDED.phone, district = EXCLUDED.district,
           status = 'rejected', rejection_reason = EXCLUDED.rejection_reason,
           registered_by = NULL, created_at = NOW()
         RETURNING *`,
        [id_number, first_name, last_name, date_of_birth, gender, phone, district, reason]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [null, rejectedResult.rows[0].id, 'SELF_REGISTER_REJECTED', `Self-registration rejected for ${id_number}: ${reason}`]
      );

      return res.status(400).json({
        message: age < MIN_AGE
          ? 'Registration denied. You must be 18 or older to register.'
          : `For clients over ${ELDERLY_AGE}, please visit a ServTech agent for assisted registration so your identity can be confirmed in person.`,
        underAge: age < MIN_AGE,
        elderlyAssistRequired: age > ELDERLY_AGE,
        client: rejectedResult.rows[0],
      });
    }

    // Year consistency check — even if the ID isn't in the registry.
    if (yearMismatch(id_number, date_of_birth)) {
      return res.status(400).json({
        message: 'The date of birth does not match the birth year encoded in the ID number. Please review both fields.',
        yearMismatch: true,
      });
    }

    // Agents may not also hold a client (betting) account, to avoid conflicts
    // of interest. Agents don't have a national ID on file, so phone number
    // is the field that can catch a person trying to register as both.
    if (phone) {
      const existingAgent = await pool.query(
        "SELECT id FROM users WHERE phone = $1 AND role = 'agent'",
        [phone]
      );
      if (existingAgent.rows.length > 0) {
        return res.status(400).json({
          message: 'This phone number is already registered to an agent account. Agents cannot also hold a client account.',
          agentConflict: true,
        });
      }
    }

    // KYC document validation — a selfie is required for self-service registration
    // since there's no agent present to confirm identity in person. Checked here,
    // after the age gate, so an underage/elderly rejection doesn't demand a photo first.
    const selfieError = validateImageDataUrl(selfie_data, { required: true, label: 'Selfie photo' });
    if (selfieError) return res.status(400).json({ message: selfieError });

    const idDocError = validateImageDataUrl(id_document_data, { required: false, label: 'ID document photo' });
    if (idDocError) return res.status(400).json({ message: idDocError });

    // Duplicate email check
    const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ message: 'This email address is already in use.' });
    }

    // A previously-rejected record for this ID number is superseded now that the
    // person is eligible — clear it out before inserting the real record.
    await pool.query("DELETE FROM clients WHERE id_number = $1 AND status = 'rejected'", [id_number]);

    // Verify against registry
    const idCheck = await pool.query('SELECT id FROM id_records WHERE id_number = $1 AND valid = true', [id_number]);
    const registryMatch = idCheck.rows.length > 0;

    // Generate password (looped to guarantee uniqueness against existing hashes is not
    // meaningful for bcrypt, so instead we simply guarantee the raw password itself is
    // freshly randomised per registration)
    const rawPassword = `ST@${first_name.charAt(0).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(10 + Math.random() * 90)}!`;
    const hashed = await bcrypt.hash(rawPassword, 10);

    // Create user account
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, role, phone, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [`${first_name} ${last_name}`, email, hashed, 'client', phone, 'active']
    );
    const userId = userResult.rows[0].id;

    // Create client record (starts pending — the workflow engine below decides the final status)
    const insertResult = await pool.query(
      `INSERT INTO clients (user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, registered_by, selfie_data, id_document_data, kyc_submitted_at, terms_accepted_at, terms_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, NOW(), NOW(), $12) RETURNING id`,
      [userId, id_number, first_name, last_name, date_of_birth, gender, phone, district, userId, selfie_data, id_document_data || null, terms_version || null]
    );
    const newClientId = insertResult.rows[0].id;

    // Run the configurable automation rules (mock face-match / document-authenticity /
    // sanctions screening + registry auto-verify) to decide the final status.
    const workflowResult = await runRegistrationWorkflow({
      clientId: newClientId,
      firstName: first_name,
      lastName: last_name,
      selfieData: selfie_data,
      idDocumentData: id_document_data,
      registryMatch,
    });

    const clientResult = await pool.query(
      `UPDATE clients SET status = $1, face_match_score = $2, document_authenticity_score = $3,
              sanctions_flag = $4, sanctions_match_name = $5, approval_chain_id = $6
       WHERE id = $7
       RETURNING id, user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, registered_by, created_at`,
      [
        workflowResult.status,
        workflowResult.faceMatchScore,
        workflowResult.documentAuthenticityScore,
        workflowResult.sanctions.flagged,
        workflowResult.sanctions.matchName,
        workflowResult.approvalChainId,
        newClientId,
      ]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [userId, newClientId, 'SELF_REGISTER', `Client self-registered: ${id_number} - status: ${clientResult.rows[0].status}`]
    );

    // Send welcome email
    await sendClientWelcomeEmail({ name: `${first_name} ${last_name}`, email, password: rawPassword });

    res.status(201).json({
      message: 'Registration successful! Check your email for login credentials.',
      client: clientResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get client's own profile + betting activity
exports.getClientDashboard = async (req, res) => {
  try {
    const clientResult = await pool.query(
      `SELECT c.id, c.user_id, c.id_number, c.first_name, c.last_name, c.date_of_birth,
              c.gender, c.phone, c.district, c.status, c.rejection_reason, c.is_active,
              c.elderly_assisted, c.registered_by, c.created_at, c.wallet_balance, u.email
       FROM clients c
       JOIN users u ON c.user_id = u.id
       WHERE c.user_id = $1`,
      [req.user.id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const client = clientResult.rows[0];

    const bettingResult = await pool.query(
      `SELECT * FROM betting_activity WHERE client_id = $1 ORDER BY placed_at DESC LIMIT 20`,
      [client.id]
    );

    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_bets,
        SUM(amount) as total_wagered,
        SUM(CASE WHEN outcome = 'win' THEN amount ELSE 0 END) as total_won,
        COUNT(CASE WHEN outcome = 'win' THEN 1 END) as wins,
        COUNT(CASE WHEN outcome = 'loss' THEN 1 END) as losses,
        COUNT(CASE WHEN outcome = 'pending' THEN 1 END) as pending
       FROM betting_activity WHERE client_id = $1`,
      [client.id]
    );

    res.json({
      client,
      bets: bettingResult.rows,
      stats: statsResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: any client. Agent: only a client they personally registered.
exports.getClientActivity = async (req, res) => {
  const { clientId } = req.params;
  try {
    const clientResult = await pool.query(
      `SELECT c.id, c.user_id, c.id_number, c.first_name, c.last_name, c.date_of_birth,
              c.gender, c.phone, c.district, c.status, c.rejection_reason, c.is_active,
              c.elderly_assisted, c.registered_by, c.created_at, c.kyc_submitted_at, c.wallet_balance,
              c.sms_opt_in, c.email_opt_in, c.approval_chain_id, c.approval_step_index,
              (c.selfie_data IS NOT NULL) AS has_selfie,
              (c.id_document_data IS NOT NULL) AS has_id_document,
              u.email, u2.name as agent_name, u2.phone as agent_phone, u2.id as agent_id
       FROM clients c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users u2 ON c.registered_by = u2.id
       WHERE c.id = $1`,
      [clientId]
    );
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    const client = clientResult.rows[0];
    if (req.user.role === 'agent' && client.agent_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only view clients you registered' });
    }

    let approvalChain = null;
    if (client.approval_chain_id) {
      const chainResult = await pool.query('SELECT id, name FROM approval_chains WHERE id = $1', [client.approval_chain_id]);
      const stepsResult = await pool.query('SELECT id, step_order, required_role, label FROM approval_chain_steps WHERE chain_id = $1 ORDER BY step_order ASC', [client.approval_chain_id]);
      if (chainResult.rows.length > 0) {
        approvalChain = { ...chainResult.rows[0], steps: stepsResult.rows, completedSteps: client.approval_step_index };
      }
    }

    const bettingResult = await pool.query(
      'SELECT * FROM betting_activity WHERE client_id = $1 ORDER BY placed_at DESC',
      [clientId]
    );

    const statsResult = await pool.query(
      `SELECT COUNT(*) as total_bets, SUM(amount) as total_wagered,
              COUNT(CASE WHEN outcome='win' THEN 1 END) as wins,
              COUNT(CASE WHEN outcome='loss' THEN 1 END) as losses,
              COUNT(CASE WHEN outcome='pending' THEN 1 END) as pending
       FROM betting_activity WHERE client_id = $1`,
      [clientId]
    );

    const timeline = await getClientTimeline(clientId);

    res.json({ client, bets: bettingResult.rows, stats: statsResult.rows[0], timeline, approvalChain });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Shared helper: fetch a client and confirm the requesting user is allowed to act on it.
// Admin can act on any client; an agent only on clients they personally registered.
const findClientForAction = async (clientId, user) => {
  const result = await pool.query(`SELECT ${SAFE_CLIENT_COLUMNS} FROM clients WHERE id = $1`, [clientId]);
  if (result.rows.length === 0) return { error: 404, message: 'Client not found' };
  const client = result.rows[0];
  if (user.role === 'agent' && client.registered_by !== user.id) {
    return { error: 403, message: 'You can only manage clients you registered' };
  }
  return { client };
};

// Builds a unified chronological activity timeline for one client: audit log
// entries (registration, review decisions, edits, status changes), messages
// sent to them, and automation-rule executions — merged and sorted newest first.
// This is what powers the "Client Activity" timeline (Module 3), since none
// of these tables alone tells the full story of what happened to a client.
const getClientTimeline = async (clientId) => {
  const [auditResult, messageResult, workflowResult] = await Promise.all([
    pool.query(
      `SELECT a.id, a.action, a.details, a.created_at, u.name AS actor_name, u.role AS actor_role
       FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
       WHERE a.client_id = $1 ORDER BY a.created_at DESC`,
      [clientId]
    ),
    pool.query(
      `SELECT m.id, m.channel, m.subject, m.status, m.error_detail, m.created_at, u.name AS actor_name
       FROM message_log m LEFT JOIN users u ON m.sent_by = u.id
       WHERE m.client_id = $1 ORDER BY m.created_at DESC`,
      [clientId]
    ),
    pool.query(
      `SELECT id, rule_name, result_summary, created_at
       FROM workflow_execution_log WHERE client_id = $1 ORDER BY created_at DESC`,
      [clientId]
    ),
  ]);

  const events = [
    ...auditResult.rows.map(r => ({
      id: `audit-${r.id}`, type: 'audit', action: r.action, details: r.details,
      actor_name: r.actor_name, actor_role: r.actor_role, created_at: r.created_at,
    })),
    ...messageResult.rows.map(r => ({
      id: `message-${r.id}`, type: 'message', action: `${r.channel.toUpperCase()} - ${r.status}`,
      details: `${r.subject ? r.subject + ' — ' : ''}${r.status === 'sent' ? 'Delivered successfully' : (r.error_detail || 'Not delivered')}`,
      actor_name: r.actor_name || 'System', actor_role: null, created_at: r.created_at,
    })),
    ...workflowResult.rows.map(r => ({
      id: `workflow-${r.id}`, type: 'workflow', action: r.rule_name, details: r.result_summary,
      actor_name: 'Automation rule', actor_role: null, created_at: r.created_at,
    })),
  ];

  events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return events;
};

// Client self-service: resubmit KYC after a rejection. Only allowed while the
// client's own status is 'rejected' — resets them to 'pending' for re-review.
exports.resubmitKyc = async (req, res) => {
  const { first_name, last_name, date_of_birth, gender, phone, district, selfie_data, id_document_data } = req.body;

  try {
    const clientResult = await pool.query(`SELECT ${SAFE_CLIENT_COLUMNS} FROM clients WHERE user_id = $1`, [req.user.id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ message: 'Client profile not found' });
    const client = clientResult.rows[0];

    if (client.status !== 'rejected') {
      return res.status(400).json({ message: 'Resubmission is only available for rejected applications.' });
    }

    const selfieError = validateImageDataUrl(selfie_data, { required: true, label: 'Selfie photo' });
    if (selfieError) return res.status(400).json({ message: selfieError });

    const idDocError = validateImageDataUrl(id_document_data, { required: false, label: 'ID document photo' });
    if (idDocError) return res.status(400).json({ message: idDocError });

    if (yearMismatch(client.id_number, date_of_birth || client.date_of_birth)) {
      return res.status(400).json({
        message: 'The date of birth does not match the birth year encoded in the ID number.',
        yearMismatch: true,
      });
    }

    // Re-check the national registry and re-run the same automation rules used
    // at initial registration, so a resubmission gets a fresh, consistent decision
    // rather than always parking back in manual review.
    const idCheck = await pool.query('SELECT id FROM id_records WHERE id_number = $1 AND valid = true', [client.id_number]);
    const registryMatch = idCheck.rows.length > 0;

    const workflowResult = await runRegistrationWorkflow({
      clientId: client.id,
      firstName: first_name || client.first_name,
      lastName: last_name || client.last_name,
      selfieData: selfie_data,
      idDocumentData: id_document_data || null,
      registryMatch,
    });

    const result = await pool.query(
      `UPDATE clients SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         date_of_birth = COALESCE($3, date_of_birth),
         gender = COALESCE($4, gender),
         phone = COALESCE($5, phone),
         district = COALESCE($6, district),
         selfie_data = $7,
         id_document_data = COALESCE($8, id_document_data),
         status = $9,
         rejection_reason = NULL,
         face_match_score = $10,
         document_authenticity_score = $11,
         sanctions_flag = $12,
         sanctions_match_name = $13,
         kyc_submitted_at = NOW(),
         approval_chain_id = $14,
         approval_step_index = 0
       WHERE id = $15
       RETURNING id, user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, created_at`,
      [
        first_name, last_name, date_of_birth, gender, phone, district, selfie_data, id_document_data,
        workflowResult.status, workflowResult.faceMatchScore, workflowResult.documentAuthenticityScore,
        workflowResult.sanctions.flagged, workflowResult.sanctions.matchName, workflowResult.approvalChainId, client.id,
      ]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, client.id, 'KYC_RESUBMIT', `Client resubmitted KYC for review: ${client.id_number}`]
    );

    res.json({ message: 'Resubmitted for review. You will be notified once it is reviewed again.', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin or owning agent: fetch KYC document images for review.
// Kept as a separate lightweight endpoint so list views never have to carry image payloads.
exports.getClientDocuments = async (req, res) => {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, registered_by, selfie_data, id_document_data, kyc_submitted_at FROM clients WHERE id = $1',
      [clientId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    const client = result.rows[0];

    if (req.user.role === 'agent' && client.registered_by !== req.user.id) {
      return res.status(403).json({ message: 'You can only view clients you registered' });
    }

    res.json({
      selfie_data: client.selfie_data || null,
      id_document_data: client.id_document_data || null,
      kyc_submitted_at: client.kyc_submitted_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin or owning agent: update editable client details (CRUD - update)
exports.updateClient = async (req, res) => {
  const { clientId } = req.params;
  let { first_name, last_name, date_of_birth, gender, phone, district, sms_opt_in, email_opt_in } = req.body;

  // COALESCE only skips a NULL, not an empty string, so without this an
  // empty/whitespace field submitted from the edit form would silently
  // blank out required client data.
  const requiredFields = { first_name, last_name, date_of_birth, gender, phone, district };
  for (const [field, value] of Object.entries(requiredFields)) {
    if (value !== undefined && (value === null || !String(value).trim())) {
      return res.status(400).json({ message: `${field.replace('_', ' ')} cannot be empty` });
    }
  }
  if (first_name !== undefined) first_name = first_name.trim();
  if (last_name !== undefined) last_name = last_name.trim();
  if (phone !== undefined) phone = phone.trim();
  if (district !== undefined) district = district.trim();

  try {
    const { error, message, client } = await findClientForAction(clientId, req.user);
    if (error) return res.status(error).json({ message });

    if (yearMismatch(client.id_number, date_of_birth || client.date_of_birth)) {
      return res.status(400).json({
        message: 'The date of birth does not match the birth year encoded in the ID number.',
        yearMismatch: true,
      });
    }

    const result = await pool.query(
      `UPDATE clients SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         date_of_birth = COALESCE($3, date_of_birth),
         gender = COALESCE($4, gender),
         phone = COALESCE($5, phone),
         district = COALESCE($6, district),
         sms_opt_in = COALESCE($7, sms_opt_in),
         email_opt_in = COALESCE($8, email_opt_in)
       WHERE id = $9 RETURNING ${SAFE_CLIENT_COLUMNS}`,
      [first_name, last_name, date_of_birth, gender, phone, district, sms_opt_in, email_opt_in, clientId]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, clientId, 'UPDATE_CLIENT', `Updated client ${client.id_number} (id ${clientId})`]
    );

    res.json({ message: 'Client updated', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: bulk-validate a set of pending clients in one action.
exports.bulkValidateClients = async (req, res) => {
  const { clientIds } = req.body;
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return res.status(400).json({ message: 'Select at least one client.' });
  }
  try {
    // Clients routed into an approval chain (sanctions match / elderly-assisted)
    // are deliberately excluded from bulk validation — bulk-approving in one
    // click would defeat the point of requiring individual sign-off steps.
    const result = await pool.query(
      `UPDATE clients SET status = 'verified', rejection_reason = NULL
       WHERE id = ANY($1::int[]) AND status = 'pending' AND approval_chain_id IS NULL
       RETURNING id, id_number`,
      [clientIds]
    );

    const skippedChainResult = await pool.query(
      `SELECT COUNT(*) FROM clients WHERE id = ANY($1::int[]) AND status = 'pending' AND approval_chain_id IS NOT NULL`,
      [clientIds]
    );
    const skippedForChain = parseInt(skippedChainResult.rows[0].count);

    const template = await pool.query(`SELECT id, subject, body FROM message_templates WHERE name = 'KYC Approved' LIMIT 1`);

    for (const row of result.rows) {
      await pool.query(
        'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [req.user.id, row.id, 'VALIDATE_CLIENT', `Validated client ${row.id_number} (id ${row.id}) — bulk action`]
      );
      const workflow = await runReviewWorkflow({ clientId: row.id, outcome: 'verified' });
      if (workflow.notify && template.rows.length > 0) {
        const t = template.rows[0];
        await sendToClient({ clientId: row.id, channel: 'email', subject: t.subject, body: t.body, templateId: t.id, sentBy: req.user.id });
      }
    }

    res.json({
      message: `${result.rows.length} client(s) validated${skippedForChain > 0 ? ` — ${skippedForChain} skipped (require individual multi-step sign-off)` : ''}`,
      validatedIds: result.rows.map(r => r.id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: bulk-reject a set of pending clients with one shared reason.
exports.bulkRejectClients = async (req, res) => {
  const { clientIds, reason } = req.body;
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return res.status(400).json({ message: 'Select at least one client.' });
  }
  try {
    const result = await pool.query(
      `UPDATE clients SET status = 'rejected', rejection_reason = $1
       WHERE id = ANY($2::int[]) AND status = 'pending'
       RETURNING id, id_number`,
      [reason || 'Rejected on manual review', clientIds]
    );

    const template = await pool.query(`SELECT id, subject, body FROM message_templates WHERE name = 'KYC Rejected' LIMIT 1`);

    for (const row of result.rows) {
      await pool.query(
        'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [req.user.id, row.id, 'REJECT_CLIENT', `Rejected client ${row.id_number} (id ${row.id}) — bulk action${reason ? ` - reason: ${reason}` : ''}`]
      );
      const workflow = await runReviewWorkflow({ clientId: row.id, outcome: 'rejected' });
      if (workflow.notify && template.rows.length > 0) {
        const t = template.rows[0];
        await sendToClient({ clientId: row.id, channel: 'email', subject: t.subject, body: t.body, templateId: t.id, sentBy: req.user.id });
      }
    }

    res.json({ message: `${result.rows.length} client(s) rejected`, rejectedIds: result.rows.map(r => r.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: any selected client. Agent: silently restricted to clients they personally registered.
exports.bulkSetClientActive = async (req, res) => {
  const { clientIds, is_active } = req.body;
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return res.status(400).json({ message: 'Select at least one client.' });
  }
  try {
    const result = req.user.role === 'agent'
      ? await pool.query(
          `UPDATE clients SET is_active = $1 WHERE id = ANY($2::int[]) AND registered_by = $3 RETURNING id, id_number, user_id`,
          [!!is_active, clientIds, req.user.id]
        )
      : await pool.query(
          `UPDATE clients SET is_active = $1 WHERE id = ANY($2::int[]) RETURNING id, id_number, user_id`,
          [!!is_active, clientIds]
        );

    for (const row of result.rows) {
      if (row.user_id) {
        await pool.query('UPDATE users SET status = $1 WHERE id = $2', [is_active ? 'active' : 'suspended', row.user_id]);
      }
      await pool.query(
        'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [req.user.id, row.id, is_active ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT', `${is_active ? 'Activated' : 'Deactivated'} client ${row.id_number} (id ${row.id}) — bulk action`]
      );
    }

    res.json({ message: `${result.rows.length} client(s) ${is_active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: approve a pending client (KYC "Validate" action).
// If the client is routed into an approval chain (sanctions match or
// elderly-assisted — see workflowEngine), this records just one sign-off
// step rather than a final decision; the client only flips to "verified"
// once every configured step has approved.
exports.validateClient = async (req, res) => {
  const { clientId } = req.params;
  try {
    const clientRow = await pool.query(`SELECT ${SAFE_CLIENT_COLUMNS} FROM clients WHERE id = $1`, [clientId]);
    if (clientRow.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    const client = clientRow.rows[0];

    if (client.approval_chain_id) {
      const stepsResult = await pool.query(
        'SELECT * FROM approval_chain_steps WHERE chain_id = $1 ORDER BY step_order ASC',
        [client.approval_chain_id]
      );
      const steps = stepsResult.rows;
      if (client.approval_step_index >= steps.length) {
        return res.status(400).json({ message: 'This client has already completed its approval chain.' });
      }
      const step = steps[client.approval_step_index];
      const newStepIndex = client.approval_step_index + 1;
      const isFinalStep = newStepIndex >= steps.length;

      await pool.query(
        'INSERT INTO approval_decisions (client_id, chain_id, step_id, decided_by, decision) VALUES ($1, $2, $3, $4, $5)',
        [clientId, client.approval_chain_id, step.id, req.user.id, 'approved']
      );

      const result = await pool.query(
        `UPDATE clients SET approval_step_index = $1, status = $2, rejection_reason = NULL WHERE id = $3 RETURNING ${SAFE_CLIENT_COLUMNS}`,
        [newStepIndex, isFinalStep ? 'verified' : 'pending', clientId]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [req.user.id, clientId, 'APPROVAL_CHAIN_STEP',
          `Approved step "${step.label}" (${newStepIndex}/${steps.length}) for ${client.id_number}${isFinalStep ? ' — chain complete, client verified' : ' — awaiting further sign-off'}`]
      );

      if (isFinalStep) {
        const workflow = await runReviewWorkflow({ clientId, outcome: 'verified' });
        if (workflow.notify) {
          const template = await pool.query(`SELECT id, subject, body FROM message_templates WHERE name = 'KYC Approved' LIMIT 1`);
          if (template.rows.length > 0) {
            const t = template.rows[0];
            await sendToClient({ clientId, channel: 'email', subject: t.subject, body: t.body, templateId: t.id, sentBy: req.user.id });
          }
        }
      }

      return res.json({
        message: isFinalStep ? 'Client verified — final approval step complete' : `Step ${newStepIndex} of ${steps.length} approved — awaiting further sign-off`,
        client: result.rows[0],
      });
    }

    const result = await pool.query(
      `UPDATE clients SET status = 'verified', rejection_reason = NULL WHERE id = $1 RETURNING ${SAFE_CLIENT_COLUMNS}`,
      [clientId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, clientId, 'VALIDATE_CLIENT', `Validated client ${result.rows[0].id_number} (id ${clientId})`]
    );

    // Configurable automation: if the "notify on approval" rule is enabled,
    // send the client an email using the KYC Approved template.
    const workflow = await runReviewWorkflow({ clientId, outcome: 'verified' });
    if (workflow.notify) {
      const template = await pool.query(`SELECT id, subject, body FROM message_templates WHERE name = 'KYC Approved' LIMIT 1`);
      if (template.rows.length > 0) {
        const t = template.rows[0];
        await sendToClient({ clientId, channel: 'email', subject: t.subject, body: t.body, templateId: t.id, sentBy: req.user.id });
      }
    }

    res.json({ message: 'Client verified', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: reject a pending client, with an optional reason
exports.rejectClient = async (req, res) => {
  const { clientId } = req.params;
  const { reason } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clients SET status = 'rejected', rejection_reason = $1 WHERE id = $2 RETURNING ${SAFE_CLIENT_COLUMNS}`,
      [reason || 'Rejected on manual review', clientId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    if (result.rows[0].approval_chain_id) {
      await pool.query(
        'INSERT INTO approval_decisions (client_id, chain_id, decided_by, decision, notes) VALUES ($1, $2, $3, $4, $5)',
        [clientId, result.rows[0].approval_chain_id, req.user.id, 'rejected', reason || null]
      );
    }

    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, clientId, 'REJECT_CLIENT', `Rejected client ${result.rows[0].id_number} (id ${clientId})${reason ? ` - reason: ${reason}` : ''}`]
    );

    // Configurable automation: if the "notify on rejection" rule is enabled,
    // send the client an email with the reason and resubmission instructions.
    const workflow = await runReviewWorkflow({ clientId, outcome: 'rejected' });
    if (workflow.notify) {
      const template = await pool.query(`SELECT id, subject, body FROM message_templates WHERE name = 'KYC Rejected' LIMIT 1`);
      if (template.rows.length > 0) {
        const t = template.rows[0];
        await sendToClient({ clientId, channel: 'email', subject: t.subject, body: t.body, templateId: t.id, sentBy: req.user.id });
      }
    }

    res.json({ message: 'Client rejected', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin or owning agent: deactivate / reactivate a client record.
// If the client has a linked login account, that login is suspended/reactivated too.
exports.setClientActive = async (req, res) => {
  const { clientId } = req.params;
  const { is_active } = req.body;
  try {
    const { error, message, client } = await findClientForAction(clientId, req.user);
    if (error) return res.status(error).json({ message });

    const result = await pool.query(
      `UPDATE clients SET is_active = $1 WHERE id = $2 RETURNING ${SAFE_CLIENT_COLUMNS}`,
      [!!is_active, clientId]
    );

    if (client.user_id) {
      await pool.query('UPDATE users SET status = $1 WHERE id = $2', [is_active ? 'active' : 'suspended', client.user_id]);
    }

    await pool.query(
      'INSERT INTO audit_logs (user_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, clientId, is_active ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT', `${is_active ? 'Activated' : 'Deactivated'} client ${client.id_number} (id ${clientId})`]
    );

    res.json({ message: is_active ? 'Client activated' : 'Client deactivated', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
