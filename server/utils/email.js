// Email sender using Nodemailer with Gmail.
//
// Setup:
//   1. Enable 2-Step Verification on the sending Gmail account.
//   2. Go to Google Account → Security → App Passwords.
//   3. Generate an App Password for "Mail" and copy the 16-character code.
//   4. Add these to your .env:
//        GMAIL_USER=your-account@gmail.com
//        GMAIL_APP_PASSWORD=your-16-char-app-password
//
// If GMAIL_USER or GMAIL_APP_PASSWORD is not set, every send*Email() function
// below logs a warning and returns { success: false, skipped: true } instead
// of throwing — the app keeps working (agents/clients still get created,
// passwords are still returned in the API response), it just means nobody
// receives the email until both vars are configured.

const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('[email] GMAIL_USER or GMAIL_APP_PASSWORD is not set — emails will be skipped.');
}

let transporter = null;
function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

// Shared send helper — every exported function below builds { subject, html }
// and hands it here, so the Gmail-specific plumbing (and the skip-if-not-configured
// behavior) only lives in one place.
async function send({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] Skipped sending — GMAIL_USER/GMAIL_APP_PASSWORD not configured. Would have emailed "${subject}" to ${to}.`);
    return { success: false, skipped: true };
  }
  try {
    await t.sendMail({
      from: `"ServTech Rwanda" <${GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send:', err);
    return { success: false };
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
          <p style="color:#374151;margin:0 0 20px;">Good news — your ServTech Rwanda agent application has been approved. You can now log in using the email and password you set when you applied.</p>
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