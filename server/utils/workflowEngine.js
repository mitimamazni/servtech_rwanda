const pool = require('../config/db');
const { mockFaceMatchScore, mockDocumentAuthenticityScore, screenSanctions } = require('./mockScreening');
const { fireWebhooks } = require('./webhooks');

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

// A rule's per-instance parameters (e.g. the score threshold below which it
// fires) live in its `config` JSONB column, editable from the step
// configuration panel in the visual designer — not hardcoded here.
const configThreshold = (rule, fallback) => {
  const value = rule?.config?.threshold;
  return typeof value === 'number' ? value : fallback;
};

// Looks up the enabled approval chain (if any) matching a condition key —
// currently only 'sanctions_or_elderly' is evaluated, but the chain's name,
// steps, and required roles are all admin-configurable via the designer.
const getActiveApprovalChain = async (conditionKey) => {
  const chainResult = await pool.query(
    'SELECT * FROM approval_chains WHERE trigger_condition = $1 AND enabled = true LIMIT 1',
    [conditionKey]
  );
  if (chainResult.rows.length === 0) return null;
  const chain = chainResult.rows[0];
  const stepsResult = await pool.query(
    'SELECT * FROM approval_chain_steps WHERE chain_id = $1 ORDER BY step_order ASC',
    [chain.id]
  );
  return { ...chain, steps: stepsResult.rows };
};

// Runs at registration time. Takes the raw submission + whether the ID number
// matched the national registry, and returns the automation outcome plus the
// mock screening scores to persist on the client row.
//
// Each enabled rule is evaluated in priority order; the first rule whose
// condition is met decides the outcome (flag for review beats auto-verify).
// After that, a separate check routes sanctions-flagged or elderly-assisted
// clients into a configurable multi-step approval chain — overriding even an
// auto-verify outcome, since those two categories should never skip human
// sign-off entirely regardless of what the scoring rules decided.
const runRegistrationWorkflow = async ({ clientId, firstName, lastName, selfieData, idDocumentData, registryMatch, elderlyAssisted = false }) => {
  const rules = await getEnabledRules('client_registered');

  const faceMatchScore = mockFaceMatchScore(selfieData, idDocumentData);
  const documentAuthenticityScore = mockDocumentAuthenticityScore(idDocumentData);
  const sanctions = screenSanctions(firstName, lastName);

  const faceMatchThreshold = configThreshold(rules.face_match_flag, 60);
  const docAuthThreshold = configThreshold(rules.doc_authenticity_flag, 50);

  let status = 'pending';
  let approvalChainId = null;

  if (rules.sanctions_escalate && sanctions.flagged) {
    status = 'pending';
    await logExecution('sanctions_escalate', rules.sanctions_escalate.name, clientId,
      `Flagged for manual review: name matched watchlist entry "${sanctions.matchName}" (mock screening).`);
  } else if (rules.face_match_flag && faceMatchScore !== null && faceMatchScore < faceMatchThreshold) {
    status = 'pending';
    await logExecution('face_match_flag', rules.face_match_flag.name, clientId,
      `Flagged for manual review: selfie/ID match confidence ${faceMatchScore}% is below the ${faceMatchThreshold}% threshold (mock screening).`);
  } else if (rules.doc_authenticity_flag && documentAuthenticityScore !== null && documentAuthenticityScore < docAuthThreshold) {
    status = 'pending';
    await logExecution('doc_authenticity_flag', rules.doc_authenticity_flag.name, clientId,
      `Flagged for manual review: document authenticity score ${documentAuthenticityScore}% is below the ${docAuthThreshold}% threshold (mock screening).`);
  } else if (rules.registry_auto_verify && registryMatch) {
    status = 'verified';
    await logExecution('registry_auto_verify', rules.registry_auto_verify.name, clientId,
      'Auto-verified: ID number matched the national registry and no screening rule flagged the application.');
  } else {
    await logExecution('manual_review_default', 'Default routing', clientId,
      'No automation rule matched, routed to manual review by default.');
  }

  // High-risk override: sanctions match or elderly-assisted registration
  // always requires the full configured sign-off chain, even if the scoring
  // rules above would otherwise have auto-verified.
  if (sanctions.flagged || elderlyAssisted) {
    const chain = await getActiveApprovalChain('sanctions_or_elderly');
    if (chain && chain.steps.length > 0) {
      status = 'pending';
      approvalChainId = chain.id;
      await logExecution('approval_chain_assigned', chain.name, clientId,
        `Routed into "${chain.name}" (${chain.steps.length}-step sign-off) — ${sanctions.flagged ? 'sanctions/PEP match' : 'elderly-assisted registration'}.`);
    }
  }

  fireWebhooks('client_registered', {
    clientId, status, faceMatchScore, documentAuthenticityScore,
    sanctionsFlagged: sanctions.flagged, approvalChainRequired: !!approvalChainId,
  }, clientId);

  return { status, faceMatchScore, documentAuthenticityScore, sanctions, approvalChainId };
};

// Runs when an admin approves/rejects a client. Fires notification rules if enabled.
// Returns which rule (if any) fired, so the caller can decide whether to actually send.
const runReviewWorkflow = async ({ clientId, outcome }) => {
  const rules = await getEnabledRules('kyc_reviewed');
  const ruleCode = outcome === 'rejected' ? 'rejection_notify' : 'approval_notify';
  const rule = rules[ruleCode];

  fireWebhooks('kyc_reviewed', { clientId, outcome }, clientId);

  if (!rule) return { notify: false };

  await logExecution(ruleCode, rule.name, clientId, `Triggered automated ${outcome} notification.`);
  return { notify: true };
};

module.exports = { runRegistrationWorkflow, runReviewWorkflow, getActiveApprovalChain };
