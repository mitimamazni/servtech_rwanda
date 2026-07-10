// Session persistence for the client self-registration wizard. If someone
// refreshes or closes the tab mid-registration, their text-field progress
// (not photos — see note below) is restored instead of starting over at step 0.
//
// Only text fields are persisted, never selfie_data / id_document_data:
// those are large base64 images that would blow past localStorage's ~5MB
// quota after a couple of drafts, and a live selfie sitting unencrypted in
// browser storage is exactly the kind of biometric data that shouldn't
// linger longer than the tab needs it. When a draft is restored, the step
// is capped before the Selfie step so the person is prompted to recapture it.

const DRAFT_KEY = 'servtech_client_register_draft';
const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

const DRAFT_FIELDS = ['id_number', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'district', 'email'];

// Steps: 0 Upload ID, 1 Your Details, 2 Contact Info, 3 Selfie, 4 Confirm.
// A restored draft can resume at most at step 2, since steps 3-4 need a
// freshly captured selfie that a draft can't provide.
const MAX_RESTORABLE_STEP = 2;

export function loadRegistrationDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft?.savedAt || Date.now() - new Date(draft.savedAt).getTime() > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return {
      step: Math.min(draft.step || 0, MAX_RESTORABLE_STEP),
      form: DRAFT_FIELDS.reduce((acc, f) => ({ ...acc, [f]: draft.form?.[f] || '' }), {}),
    };
  } catch {
    return null;
  }
}

export function saveRegistrationDraft(step, form) {
  try {
    const draftForm = DRAFT_FIELDS.reduce((acc, f) => ({ ...acc, [f]: form[f] || '' }), {});
    // Nothing worth saving yet — skip writing an empty draft.
    if (step === 0 && Object.values(draftForm).every(v => !v)) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), step, form: draftForm }));
  } catch {
    // Storage full/unavailable (e.g. private browsing) — draft saving is a
    // convenience, not a requirement, so fail silently.
  }
}

export function clearRegistrationDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}
