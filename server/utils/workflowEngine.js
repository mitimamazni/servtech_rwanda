const pool = require('../config/db');
const { mockFaceMatchScore, mockDocumentAuthenticityScore, screenSanctions } = require('./mockScreening');

const getEnabledRules = async (triggerEvent) => {
  const result = await pool.query(
    'SELECT * FROM automation_rules WHERE trigger_event = $1 AND enabled = true ORDER BY sort_order ASC',
    [triggerEvent]
  );
  const byCode = {};
  result.rows.forEach(r => { byCode[r.code] = r; });
  return byCode;
};

const logExecution = (ruleCode, ruleName, clientId, summary) =>
  pool.query(
    'INSERT INTO workflow_execution_log (rule_code, rule_name, client_id, result_summary) VALUES ($1, $2, $3, $4)',
    [ruleCode, ruleName, clientId, summary]
  );

// Runs at registration time. Takes the raw submission + whether the ID number
// matched the national registry, and returns the automation outcome plus the
// mock screening scores to persist on the client row.
//
// Each enabled rule is evaluated in priority order; the first rule whose
// condition is met decides the outcome (flag for review beats auto-verify).
// This is a simplified rule engine — deliberately readable/demoable rather
// than a generic condition-tree evaluator — but every rule is genuinely
// read from the database and can be toggled on/off by an admin at runtime.
const runRegistrationWorkflow = async ({ clientId, firstName, lastName, selfieData, idDocumentData, registryMatch }) => {
  const rules = await getEnabledRules('client_registered');

  const faceMatchScore = mockFaceMatchScore(selfieData, idDocumentData);
  const documentAuthenticityScore = mockDocumentAuthenticityScore(idDocumentData);
  const sanctions = screenSanctions(firstName, lastName);

  let status = 'pending';
  let rejectionReason = null;

  if (rules.sanctions_escalate && sanctions.flagged) {
    status = 'pending';
    await logExecution('sanctions_escalate', rules.sanctions_escalate.name, clientId,
      `Flagged for manual review: name matched watchlist entry "${sanctions.matchName}" (mock screening).`);
  } else if (rules.face_match_flag && faceMatchScore !== null && faceMatchScore < 60) {
    status = 'pending';
    await logExecution('face_match_flag', rules.face_match_flag.name, clientId,
      `Flagged for manual review: selfie/ID match confidence ${faceMatchScore}% is below the 60% threshold (mock screening).`);
  } else if (rules.doc_authenticity_flag && documentAuthenticityScore !== null && documentAuthenticityScore < 50) {
    status = 'pending';
    await logExecution('doc_authenticity_flag', rules.doc_authenticity_flag.name, clientId,
      `Flagged for manual review: document authenticity score ${documentAuthenticityScore}% is below the 50% threshold (mock screening).`);
  } else if (rules.registry_auto_verify && registryMatch) {
    status = 'verified';
    await logExecution('registry_auto_verify', rules.registry_auto_verify.name, clientId,
      'Auto-verified: ID number matched the national registry and no screening rule flagged the application.');
  } else {
    await logExecution('manual_review_default', 'Default routing', clientId,
      'No automation rule matched, routed to manual review by default.');
  }

  return { status, rejectionReason, faceMatchScore, documentAuthenticityScore, sanctions };
};

// Runs when an admin approves/rejects a client. Fires notification rules if enabled.
// Returns which rule (if any) fired, so the caller can decide whether to actually send.
const runReviewWorkflow = async ({ clientId, outcome }) => {
  const rules = await getEnabledRules('kyc_reviewed');
  const ruleCode = outcome === 'rejected' ? 'rejection_notify' : 'approval_notify';
  const rule = rules[ruleCode];
  if (!rule) return { notify: false };

  await logExecution(ruleCode, rule.name, clientId, `Triggered automated ${outcome} notification.`);
  return { notify: true };
};

module.exports = { runRegistrationWorkflow, runReviewWorkflow };
