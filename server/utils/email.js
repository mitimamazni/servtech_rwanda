const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY is not set — emails will be skipped.');
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

exports.sendAgentWelcomeEmail = async ({ name, email, password }) => {
  try {
    if (!resend) {
      console.warn('[email] Skipped sending — RESEND_API_KEY not configured.');
      return { success: false, skipped: true };
    }
    await resend.emails.send({
      from: 'ServTech Rwanda <noreply@servtech.rw>',
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
    return { success: true };
  } catch (err) {
    console.error('Email error:', err);
    return { success: false };
  }
};

exports.sendAgentApprovedEmail = async ({ name, email }) => {
  try {
    if (!resend) {
      console.warn('[email] Skipped sending — RESEND_API_KEY not configured.');
      return { success: false, skipped: true };
    }
    await resend.emails.send({
      from: 'ServTech Rwanda <noreply@servtech.rw>',
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
    return { success: true };
  } catch (err) {
    console.error('Email error:', err);
    return { success: false };
  }
};

exports.sendClientWelcomeEmail = async ({ name, email, password }) => {
  try {
    if (!resend) {
      console.warn('[email] Skipped sending — RESEND_API_KEY not configured.');
      return { success: false, skipped: true };
    }
    await resend.emails.send({
      from: 'ServTech Rwanda <noreply@servtech.rw>',
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
    return { success: true };
  } catch (err) {
    console.error('Email error:', err);
    return { success: false };
  }
};

// Generic templated email send — used by the Communications module (message
// templates, bulk messaging, and automated approval/rejection notifications)
// so that free-text subject/body from an admin-authored template can go out
// without needing a bespoke function for every message.
exports.sendRawEmail = async (to, subject, bodyText) => {
  try {
    if (!resend) {
      console.warn('[email] Skipped sending — RESEND_API_KEY not configured.');
      return { success: false, skipped: true };
    }
    await resend.emails.send({
      from: 'ServTech Rwanda <noreply@servtech.rw>',
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
    return { success: true };
  } catch (err) {
    console.error('Email error:', err);
    return { success: false };
  }
};
