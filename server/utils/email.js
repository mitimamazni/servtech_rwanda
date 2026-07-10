// Email sender using Brevo's Transactional Email API (HTTPS), not raw SMTP.
//
// Why: Render's free tier blocks outbound traffic on SMTP ports (25, 465,
// 587), so any SMTP-based sender (e.g. Gmail via nodemailer) just hangs and
// times out from a Render free-tier service. Brevo's API sends over regular
// HTTPS (port 443), which isn't blocked.
//
// Setup:
//   1. Create a free Brevo account: https://www.brevo.com (300 emails/day,
//      permanent free tier — no domain required).
//   2. Settings → Senders, Domains, IPs → Senders → Add a sender. Use your
//      existing Gmail address (e.g. servtech.250@gmail.com) as the sender —
//      Brevo verifies it by emailing a 6-digit code to that address, no
//      domain purchase needed. (Domain authentication is optional and only
//      improves deliverability; a plain Gmail sender still sends fine.)
//   3. Settings → SMTP & API → API Keys → Generate a new API key.
//   4. Add these to your .env / Render environment:
//        BREVO_API_KEY=your-api-key
//        BREVO_SENDER_EMAIL=servtech.250@gmail.com   (the address you verified)
//        BREVO_SENDER_NAME=ServTech Rwanda            (optional, defaults below)
//
// If BREVO_API_KEY or BREVO_SENDER_EMAIL is not set, every send*Email()
// function below logs a warning and returns { success: false, skipped: true }
// instead of throwing — the app keeps working (agents/clients still get
// created, passwords are still returned in the API response), it just means
// nobody receives the email until both vars are configured.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'ServTech Rwanda';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
  console.warn('[email] BREVO_API_KEY or BREVO_SENDER_EMAIL is not set — emails will be skipped.');
}

// Shared send helper — every exported function below builds { subject, html }
// and hands it here, so the Brevo-specific plumbing (and the skip-if-not-configured
// behavior) only lives in one place.
async function send({ to, subject, html }) {
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    console.warn(`[email] Skipped sending — BREVO_API_KEY/BREVO_SENDER_EMAIL not configured. Would have emailed "${subject}" to ${to}.`);
    return { success: false, skipped: true, reason: 'Email is not configured on the server (BREVO_API_KEY/BREVO_SENDER_EMAIL missing)' };
  }
  try {
    // Fail fast rather than hang — a stuck request here shouldn't ever again
    // hold up an account-creation response the way the old SMTP timeout did.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response;
    try {
      response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const reason = body.message || `Brevo rejected the send (HTTP ${response.status})`;
      console.error('[email] Failed to send:', reason);
      return { success: false, reason };
    }

    return { success: true };
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'Timed out contacting Brevo' : (err.message || 'Email provider request failed');
    console.error('[email] Failed to send:', err);
    return { success: false, reason };
  }
}

exports.sendAgentWelcomeEmail = async ({ name, email, password }) => {
  return send({
    to: email,
    subject: 'Your ServTech Rwanda Agent Account',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#4338ca,#6366f1);border-radius:12px;padding:14px 20px;">
            <span style="color:white;font-size:22px;font-weight:700;">ST</span>
          </div>
          <h2 style="color:#1f2937;margin-top:16px;font-size:20px;">Welcome to ServTech Rwanda</h2>
        </div>
        <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb;">
          <p style="color:#374151;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
          <p style="color:#374151;margin:0 0 20px;">An agent account has been created for you on the ServTech Rwanda Client Registration System.</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;">Your Login Credentials</p>
            <p style="margin:0 0 6px;color:#111827;"><strong>Email:</strong> ${email}</p>
            <p style="margin:0;color:#111827;"><strong>Temporary Password:</strong> <span style="font-family:monospace;background:#e5e7eb;padding:2px 6px;border-radius:4px;">${password}</span></p>
          </div>
          <p style="color:#374151;margin:0 0 20px;font-size:14px;">Please change your password after your first login.</p>
          <div style="text-align:center;">
            <a href="${process.env.CLIENT_URL || 'https://servtech-rwanda.vercel.app'}/login"
               style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
              Log in to ServTech
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">ServTech Rwanda - Client Registration System</p>
      </div>`,
  });
};

exports.sendAgentApprovedEmail = async ({ name, email }) => {
  return send({
    to: email,
    subject: 'Your ServTech Rwanda Agent Application Has Been Approved',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#4338ca,#6366f1);border-radius:12px;padding:14px 20px;">
            <span style="color:white;font-size:22px;font-weight:700;">ST</span>
          </div>
          <h2 style="color:#1f2937;margin-top:16px;font-size:20px;">You're Approved!</h2>
        </div>
        <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb;">
          <p style="color:#374151;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
          <p style="color:#374151;margin:0 0 20px;">Good news, your ServTech Rwanda agent application has been approved. You can now log in using the email and password you set when you applied.</p>
          <div style="text-align:center;">
            <a href="${process.env.CLIENT_URL || 'https://servtech-rwanda.vercel.app'}/login"
               style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
              Log in to ServTech
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">ServTech Rwanda - Client Registration System</p>
      </div>`,
  });
};

exports.sendClientWelcomeEmail = async ({ name, email, password }) => {
  return send({
    to: email,
    subject: 'Welcome to ServTech Rwanda - Registration Successful',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#4338ca,#6366f1);border-radius:12px;padding:14px 20px;">
            <span style="color:white;font-size:22px;font-weight:700;">ST</span>
          </div>
          <h2 style="color:#1f2937;margin-top:16px;font-size:20px;">Registration Successful</h2>
        </div>
        <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb;">
          <p style="color:#374151;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
          <p style="color:#374151;margin:0 0 20px;">You have successfully registered on ServTech Rwanda. Use the credentials below to log in and view your dashboard.</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;">Your Login Credentials</p>
            <p style="margin:0 0 6px;color:#111827;"><strong>Email:</strong> ${email}</p>
            <p style="margin:0;color:#111827;"><strong>Password:</strong> <span style="font-family:monospace;background:#e5e7eb;padding:2px 6px;border-radius:4px;">${password}</span></p>
          </div>
          <div style="text-align:center;">
            <a href="${process.env.CLIENT_URL || 'https://servtech-rwanda.vercel.app'}/login"
               style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
              View My Dashboard
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">ServTech Rwanda - Client Registration System</p>
      </div>`,
  });
};

// Generic templated email send — used by the Communications module (message
// templates, bulk messaging, and automated approval/rejection notifications)
// so that free-text subject/body from an admin-authored template can go out
// without needing a bespoke function for every message.
exports.sendRawEmail = async (to, subject, bodyText) => {
  return send({
    to,
    subject: subject || 'Notification from ServTech Rwanda',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
        <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb;">
          <p style="color:#374151;white-space:pre-wrap;margin:0;">${bodyText}</p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">ServTech Rwanda - Client Registration System</p>
      </div>`,
  });
};