// ─────────────────────────────────────────────────────────────────────────
// MOCK KYC SCREENING LAYERS — for demo/defense purposes only.
//
// A production system would replace each of these with a real integration:
//   - Face matching     → AWS Rekognition CompareFaces / Azure Face API
//   - Document forensics → a document-authenticity vendor (e.g. Onfido, Jumio)
//   - Sanctions/PEP      → a real screening provider (ComplyAdvantage, World-Check)
//
// These are deterministic simulations (based on hashing the inputs) so the
// same client record always produces the same score/flag on repeated views,
// which makes the demo behave consistently rather than re-rolling randomly.
// ─────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const sanctionsList = require('../config/mock_sanctions_list.json');

// Turns any string into a stable number in [0, 100] — used to fake a
// "confidence score" that's consistent for the same input every time.
const hashToScore = (input, min = 0, max = 100) => {
  const hash = crypto.createHash('sha256').update(input || 'none').digest('hex');
  const n = parseInt(hash.substring(0, 8), 16);
  return min + (n % (max - min + 1));
};

const normalizeName = (name) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');

// MOCK — simulated selfie-to-ID face match. In production this would send
// both images to a real face-comparison API and use its actual similarity score.
const mockFaceMatchScore = (selfieData, idDocumentData) => {
  if (!selfieData) return null; // nothing to compare
  // Bias scores upward (65-99) when both images are present, so the demo
  // mostly shows healthy matches with occasional low-confidence flags —
  // matching what you'd expect from a real matcher on genuine submissions.
  const raw = hashToScore(`${selfieData.slice(0, 100)}|${(idDocumentData || '').slice(0, 100)}`, 0, 100);
  return idDocumentData ? 65 + (raw % 35) : Math.min(raw, 70);
};

// MOCK — simulated document authenticity/tamper check.
const mockDocumentAuthenticityScore = (idDocumentData) => {
  if (!idDocumentData) return null;
  const raw = hashToScore(idDocumentData.slice(0, 200), 0, 100);
  return 55 + (raw % 45); // biased toward "likely genuine" for the demo
};

// MOCK — screens a name against a small local fictional watchlist.
// Real system: call a licensed sanctions/PEP screening API instead.
const screenSanctions = (firstName, lastName) => {
  const fullName = normalizeName(`${firstName} ${lastName}`);
  const nameWords = fullName.split(' ').filter(Boolean);

  for (const entry of sanctionsList.entries) {
    const entryName = normalizeName(entry.name);
    const entryWords = entryName.split(' ').filter(Boolean);
    const overlap = nameWords.filter(w => entryWords.includes(w)).length;

    if (entryName === fullName || overlap >= 2) {
      return { flagged: true, matchName: entry.name, reason: entry.reason };
    }
  }
  return { flagged: false, matchName: null, reason: null };
};

module.exports = { mockFaceMatchScore, mockDocumentAuthenticityScore, screenSanctions };
