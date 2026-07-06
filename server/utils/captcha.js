const jwt = require('jsonwebtoken');

const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || process.env.JWT_SECRET;
const CAPTCHA_TTL_SECONDS = 120;

// Generates a simple arithmetic challenge. The answer is embedded in a
// short-lived signed token rather than kept in server memory/session, so
// this works fine even with multiple server instances or restarts.
const generateChallenge = () => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer;
  if (op === '+') answer = a + b;
  else if (op === '-') answer = a - b;
  else answer = a * b;

  const token = jwt.sign({ answer }, CAPTCHA_SECRET, { expiresIn: CAPTCHA_TTL_SECONDS });
  return { question: `${a} ${op} ${b}`, token };
};

// Returns null if valid, or an error message string if not.
const verifyChallenge = (token, submittedAnswer) => {
  if (!token) return 'CAPTCHA is required.';
  try {
    const decoded = jwt.verify(token, CAPTCHA_SECRET);
    if (parseInt(submittedAnswer, 10) !== decoded.answer) {
      return 'Incorrect CAPTCHA answer. Please try again.';
    }
    return null;
  } catch (err) {
    return 'CAPTCHA has expired. Please refresh and try again.';
  }
};

module.exports = { generateChallenge, verifyChallenge };
