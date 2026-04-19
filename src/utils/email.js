// ============================================================
// utils/email.js — Nodemailer email sender
// ============================================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const templates = {
  emailVerify: (data) => ({
    subject: '✅ Verify Your OpenWork Account',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#13131A;color:#F0EFF8;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6C4EF6,#00E5C3);padding:32px;text-align:center;">
          <h1 style="margin:0;font-size:28px;color:#fff;">OpenWork</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.8);">AI-Powered Freelancing Platform</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#F0EFF8;">Welcome, ${data.name}! 👋</h2>
          <p style="color:#9896B4;line-height:1.6;">Thank you for joining OpenWork. Please verify your email address to unlock full access to your account.</p>
          <a href="${data.url}" style="display:inline-block;margin:24px 0;background:linear-gradient(135deg,#6C4EF6,#00E5C3);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Verify Email Address</a>
          <p style="color:#5E5C7A;font-size:13px;">Link expires in 24 hours. If you didn't create an account, ignore this email.</p>
        </div>
      </div>`,
  }),
  passwordReset: (data) => ({
    subject: '🔐 Reset Your OpenWork Password',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#13131A;color:#F0EFF8;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#6C4EF6,#FF6B35);padding:32px;text-align:center;">
          <h1 style="margin:0;font-size:28px;color:#fff;">OpenWork</h1>
        </div>
        <div style="padding:32px;">
          <h2>Hi ${data.name},</h2>
          <p style="color:#9896B4;line-height:1.6;">We received a request to reset your password. Click the button below to set a new password.</p>
          <a href="${data.url}" style="display:inline-block;margin:24px 0;background:#6C4EF6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Reset Password</a>
          <p style="color:#5E5C7A;font-size:13px;">Link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>`,
  }),
};

exports.sendEmail = async ({ to, subject, template, data, html }) => {
  const tmpl = template && templates[template] ? templates[template](data) : null;
  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'OpenWork'}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: tmpl ? tmpl.subject : subject,
    html: tmpl ? tmpl.html : html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('❌ Email failed:', err.message);
    throw err;
  }
};

