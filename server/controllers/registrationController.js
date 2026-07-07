const pool = require('../config/db');
const { validateImageDataUrl } = require('../utils/kyc');
const { runRegistrationWorkflow } = require('../utils/workflowEngine');

const MIN_AGE = 18;
const ELDERLY_AGE = 80;

// Age check from Rwanda ID format: positions 1-4 = birth year
const getAgeFromId = (id_number) => {
  const birthYear = parseInt(id_number.substring(1, 5));
  return new Date().getFullYear() - birthYear;
};

// Cross-check that a manually-entered date of birth agrees with the birth year
// encoded in the ID number. Runs regardless of whether the ID is present in the
// national registry, since a registry match isn't required to catch a typo/mismatch.
const yearMismatch = (id_number, date_of_birth) => {
  if (!id_number || !date_of_birth || id_number.length < 5) return false;
  const idYear = parseInt(id_number.substring(1, 5));
  const dobYear = new Date(date_of_birth).getFullYear();
  if (Number.isNaN(idYear) || Number.isNaN(dobYear)) return false;
  return idYear !== dobYear;
};

exports.verifyId = async (req, res) => {
  const { id_number, self } = req.body;
  try {
    // Age gate
    const age = getAgeFromId(id_number);
    if (age < MIN_AGE) {
      return res.status(400).json({
        verified: false,
        underAge: true,
        message: `Registration denied. This person is approximately ${age} years old. Minimum age is ${MIN_AGE}.`,
      });
    }

    // Self-service registrants above the elderly threshold must be redirected to
    // an agent so identity can be confirmed in person; agents may continue and
    // will be asked to confirm identity explicitly before submitting.
    if (age > ELDERLY_AGE && self) {
      return res.status(400).json({
        verified: false,
        elderlyAssistRequired: true,
        message: `For clients over ${ELDERLY_AGE}, please visit a ServTech agent for assisted registration so your identity can be confirmed in person.`,
      });
    }

    const result = await pool.query(
      'SELECT * FROM id_records WHERE id_number = $1 AND valid = true',
      [id_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ verified: false, message: 'ID not found in national registry', elderly: age > ELDERLY_AGE });
    }

    const record = result.rows[0];
    if (yearMismatch(id_number, record.date_of_birth)) {
      return res.status(400).json({
        verified: false,
        yearMismatch: true,
        message: 'The birth year encoded in this ID number does not match the registry record. Please double-check the ID number.',
      });
    }

    res.json({
      verified: true,
      elderly: age > ELDERLY_AGE,
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
  const { id_number, first_name, last_name, date_of_birth, gender, phone, district, elderly_confirmed, selfie_data, id_document_data } = req.body;

  try {
    // Optional here — the agent has already confirmed identity in person —
    // but if provided, images still must be well-formed.
    const selfieError = validateImageDataUrl(selfie_data, { required: false, label: 'Selfie photo' });
    if (selfieError) return res.status(400).json({ message: selfieError });
    const idDocError = validateImageDataUrl(id_document_data, { required: false, label: 'ID document photo' });
    if (idDocError) return res.status(400).json({ message: idDocError });

    // Age gate — agents may not register minors under any circumstances.
    const age = getAgeFromId(id_number);
    if (age < MIN_AGE) {
      await pool.query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [req.user.id, 'REGISTRATION_REJECTED', `Attempted registration of ${id_number} rejected - under ${MIN_AGE} (approx. age ${age})`]
      );
      return res.status(400).json({
        message: `Registration denied. This person is approximately ${age} years old. Minimum age is ${MIN_AGE}.`,
        underAge: true,
      });
    }

    // Elderly clients (80+) require an explicit in-person identity confirmation
    // from the agent before the registration can be submitted.
    if (age > ELDERLY_AGE && !elderly_confirmed) {
      return res.status(400).json({
        message: `This client is approximately ${age} years old. Please confirm you have verified their identity in person before continuing.`,
        elderlyConfirmRequired: true,
      });
    }

    // Year consistency check — catches a mismatched/mistyped ID number even
    // when the ID isn't present in the national registry.
    if (yearMismatch(id_number, date_of_birth)) {
      return res.status(400).json({
        message: 'The date of birth does not match the birth year encoded in the ID number. Please review both fields.',
        yearMismatch: true,
      });
    }

    // Agents may not also hold a client (betting) account. Agents don't have
    // a national ID on file, so phone number is the field that can catch a
    // person trying to be registered as both.
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

    // Duplicate check — a previously rejected attempt doesn't block a fresh one
    const existing = await pool.query(
      "SELECT id, status FROM clients WHERE id_number = $1 AND status != 'rejected'",
      [id_number]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        message: 'This ID is already registered on ServTech Rwanda.',
        duplicate: true,
        existingStatus: existing.rows[0].status,
      });
    }
    await pool.query("DELETE FROM clients WHERE id_number = $1 AND status = 'rejected'", [id_number]);

    const idCheck = await pool.query('SELECT id FROM id_records WHERE id_number = $1 AND valid = true', [id_number]);
    const registryMatch = idCheck.rows.length > 0;
    const elderlyAssisted = age > ELDERLY_AGE;

    const insertResult = await pool.query(
      `INSERT INTO clients (id_number, first_name, last_name, date_of_birth, gender, phone, district, status, elderly_assisted, registered_by, selfie_data, id_document_data, kyc_submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, NOW())
       RETURNING id`,
      [id_number, first_name, last_name, date_of_birth, gender, phone, district, elderlyAssisted, req.user.id, selfie_data || null, id_document_data || null]
    );
    const newClientId = insertResult.rows[0].id;

    // Agent has already confirmed identity in person, but registration still
    // runs through the same configurable automation rules (mock screening +
    // registry auto-verify) for a consistent, auditable decision trail.
    const workflowResult = await runRegistrationWorkflow({
      clientId: newClientId,
      firstName: first_name,
      lastName: last_name,
      selfieData: selfie_data,
      idDocumentData: id_document_data,
      registryMatch,
    });
    const status = workflowResult.status;

    const result = await pool.query(
      `UPDATE clients SET status = $1, face_match_score = $2, document_authenticity_score = $3,
              sanctions_flag = $4, sanctions_match_name = $5
       WHERE id = $6
       RETURNING id, id_number, first_name, last_name, date_of_birth, gender, phone, district, status, elderly_assisted, registered_by, created_at`,
      [status, workflowResult.faceMatchScore, workflowResult.documentAuthenticityScore, workflowResult.sanctions.flagged, workflowResult.sanctions.matchName, newClientId]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'REGISTER_CLIENT', `Registered client ${id_number} - status: ${status}${elderlyAssisted ? ' (elderly, identity confirmed in person)' : ''}`]
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
      SELECT c.id, c.user_id, c.id_number, c.first_name, c.last_name, c.date_of_birth,
             c.gender, c.phone, c.district, c.status, c.rejection_reason, c.is_active,
             c.elderly_assisted, c.registered_by, c.created_at, c.kyc_submitted_at,
             c.sms_opt_in, c.email_opt_in,
             (c.selfie_data IS NOT NULL) AS has_selfie,
             (c.id_document_data IS NOT NULL) AS has_id_document,
             u.name as agent_name, u.phone as agent_phone, u.email as agent_email
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
    const rejected = await pool.query(`SELECT COUNT(*) FROM clients${where}${where ? ' AND' : ' WHERE'} status = 'rejected'`, params);
    const today    = await pool.query(`SELECT COUNT(*) FROM clients${where}${where ? ' AND' : ' WHERE'} created_at::date = CURRENT_DATE`, params);

    res.json({
      total:    parseInt(total.rows[0].count),
      verified: parseInt(verified.rows[0].count),
      pending:  parseInt(pending.rows[0].count),
      rejected: parseInt(rejected.rows[0].count),
      today:    parseInt(today.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
