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
  created_at, kyc_submitted_at,
  face_match_score, document_authenticity_score, sanctions_flag, sanctions_match_name,
  sms_opt_in, email_opt_in,
  (selfie_data IS NOT NULL) AS has_selfie,
  (id_document_data IS NOT NULL) AS has_id_document
`;

// Client self-registration
exports.selfRegister = async (req, res) => {
  const { id_number, first_name, last_name, date_of_birth, gender, phone, district, email, selfie_data, id_document_data, captcha_token, captcha_answer } = req.body;

  try {
    const captchaError = verifyChallenge(captcha_token, captcha_answer);
    if (captchaError) return res.status(400).json({ message: captchaError });

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
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [null, 'SELF_REGISTER_REJECTED', `Self-registration rejected for ${id_number}: ${reason}`]
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
      `INSERT INTO clients (user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, registered_by, selfie_data, id_document_data, kyc_submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, NOW()) RETURNING id`,
      [userId, id_number, first_name, last_name, date_of_birth, gender, phone, district, userId, selfie_data, id_document_data || null]
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
              sanctions_flag = $4, sanctions_match_name = $5
       WHERE id = $6
       RETURNING id, user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, registered_by, created_at`,
      [
        workflowResult.status,
        workflowResult.faceMatchScore,
        workflowResult.documentAuthenticityScore,
        workflowResult.sanctions.flagged,
        workflowResult.sanctions.matchName,
        newClientId,
      ]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [userId, 'SELF_REGISTER', `Client self-registered: ${id_number} - status: ${status}`]
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
              c.elderly_assisted, c.registered_by, c.created_at, u.email
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
              c.elderly_assisted, c.registered_by, c.created_at, c.kyc_submitted_at,
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

    res.json({ client, bets: bettingResult.rows, stats: statsResult.rows[0] });
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
         kyc_submitted_at = NOW()
       WHERE id = $14
       RETURNING id, user_id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, created_at`,
      [
        first_name, last_name, date_of_birth, gender, phone, district, selfie_data, id_document_data,
        workflowResult.status, workflowResult.faceMatchScore, workflowResult.documentAuthenticityScore,
        workflowResult.sanctions.flagged, workflowResult.sanctions.matchName, client.id,
      ]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'KYC_RESUBMIT', `Client resubmitted KYC for review: ${client.id_number}`]
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
  const { first_name, last_name, date_of_birth, gender, phone, district, sms_opt_in, email_opt_in } = req.body;

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
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'UPDATE_CLIENT', `Updated client ${client.id_number} (id ${clientId})`]
    );

    res.json({ message: 'Client updated', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: approve a pending client (KYC "Validate" action)
exports.validateClient = async (req, res) => {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE clients SET status = 'verified', rejection_reason = NULL WHERE id = $1 RETURNING ${SAFE_CLIENT_COLUMNS}`,
      [clientId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'VALIDATE_CLIENT', `Validated client ${result.rows[0].id_number} (id ${clientId})`]
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

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'REJECT_CLIENT', `Rejected client ${result.rows[0].id_number} (id ${clientId})${reason ? ` - reason: ${reason}` : ''}`]
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
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, is_active ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT', `${is_active ? 'Activated' : 'Deactivated'} client ${client.id_number} (id ${clientId})`]
    );

    res.json({ message: is_active ? 'Client activated' : 'Client deactivated', client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
