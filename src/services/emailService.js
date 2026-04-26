// utils/emailService.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Email Verification ───────────────────────────────────────────────────────
exports.sendVerificationEmail = async (toEmail, fullName, token) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
    to: toEmail,
    subject: '✅ Verify your OpenWork email',
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background:#0f0e1a;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:#1a1927;border-radius:16px;border:1px solid #2a2940;overflow:hidden;">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#6C4EF6,#4f35d4);padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">OpenWork</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Freelance Marketplace</p>
          </div>

          <!-- Body -->
          <div style="padding:32px;">
            <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Hi ${fullName}! 👋</h2>
            <p style="color:#9896B4;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Welcome to OpenWork! Please verify your email address to activate your account and start working.
            </p>

            <!-- CTA Button -->
            <div style="text-align:center;margin:32px 0;">
              <a href="${verifyUrl}" 
                 style="display:inline-block;background:#6C4EF6;color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                ✅ Verify My Email
              </a>
            </div>

            <p style="color:#6b6984;font-size:13px;margin:24px 0 0;">
              This link expires in <strong style="color:#9896B4">24 hours</strong>. 
              If you didn't create an account, ignore this email.
            </p>
            
            <!-- Fallback link -->
            <p style="color:#6b6984;font-size:12px;margin:12px 0 0;">
              If the button doesn't work, copy this link:<br>
              <a href="${verifyUrl}" style="color:#6C4EF6;word-break:break-all;">${verifyUrl}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="padding:20px 32px;border-top:1px solid #2a2940;text-align:center;">
            <p style="color:#6b6984;font-size:12px;margin:0;">
              © ${new Date().getFullYear()} OpenWork · You're receiving this because you signed up
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  });
};

// ─── Password Reset ───────────────────────────────────────────────────────────
exports.sendPasswordResetEmail = async (toEmail, fullName, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
    to: toEmail,
    subject: '🔑 Reset your OpenWork password',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0f0e1a;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:40px auto;background:#1a1927;border-radius:16px;border:1px solid #2a2940;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#6C4EF6,#4f35d4);padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">OpenWork</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Password Reset Request</h2>
            <p style="color:#9896B4;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Hi ${fullName}, click the button below to reset your password. This link expires in 1 hour.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}" style="display:inline-block;background:#6C4EF6;color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700;">
                🔑 Reset Password
              </a>
            </div>
            <p style="color:#6b6984;font-size:13px;">If you didn't request this, ignore this email. Your password won't change.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
};

// ─── Email OTP Verification ───────────────────────────────────────────────────
exports.sendEmailOtp = async (toEmail, fullName, otp) => {
  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
    to: toEmail,
    subject: '🔐 Your OpenWork Email Verification Code',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>

<body style="
  margin:0;
  padding:0;
  background:#0b0b12;
  font-family: 'Segoe UI', system-ui, sans-serif;
">

  <div style="
    max-width:520px;
    margin:48px auto;
    background:#141426;
    border-radius:18px;
    overflow:hidden;
    border:1px solid rgba(255,255,255,0.06);
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  ">

    <!-- HEADER -->
    <div style="
      background:linear-gradient(135deg,#6C4EF6,#7C5CFF);
      padding:36px 28px;
      text-align:center;
    ">
      <h1 style="
        color:#fff;
        margin:0;
        font-size:26px;
        font-weight:800;
        letter-spacing:0.5px;
      ">
        OpenWork
      </h1>

      <p style="
        color:rgba(255,255,255,0.85);
        margin:8px 0 0;
        font-size:14px;
      ">
        Freelance Marketplace
      </p>
    </div>

    <!-- BODY -->
    <div style="padding:34px 30px;">

      <h2 style="
        color:#ffffff;
        font-size:20px;
        margin:0 0 10px;
        font-weight:700;
      ">
        Hi ${fullName}! 👋
      </h2>

      <p style="
        color:#a9a7c1;
        font-size:15px;
        line-height:1.7;
        margin:0 0 26px;
      ">
        Welcome to OpenWork! Use the code below to verify your account and get started.
      </p>

      <!-- OTP BOX -->
      <div style="
        background:rgba(108,78,246,0.08);
        border:1px solid rgba(108,78,246,0.35);
        border-radius:14px;
        padding:28px 20px;
        text-align:center;
        margin:30px 0;
      ">

        <p style="
          color:#8f8ca8;
          font-size:13px;
          margin:0 0 10px;
        ">
          Your verification code
        </p>

        <p style="
          color:#6C4EF6;
          font-size:38px;
          font-weight:900;
          letter-spacing:10px;
          margin:0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        ">
          ${otp}
        </p>

        <p style="
          color:#7b7896;
          font-size:12px;
          margin:12px 0 0;
        ">
          Valid for 10 minutes
        </p>

      </div>

      <p style="
        color:#b0aec9;
        font-size:14px;
        line-height:1.7;
        margin:0 0 14px;
      ">
        Enter this code on the verification page to activate your account.
      </p>

      <p style="
        color:#ff6b6b;
        font-size:13px;
        margin:0;
      ">
        ⚠ Do not share this code with anyone.
      </p>

      <div style="
        margin-top:26px;
        padding-top:18px;
        border-top:1px solid rgba(255,255,255,0.06);
      ">
        <p style="
          color:#7b7896;
          font-size:12px;
          margin:0;
        ">
          If you didn’t request this email, you can safely ignore it.
        </p>
      </div>

    </div>

    <!-- FOOTER -->
    <div style="
      padding:18px 30px;
      text-align:center;
      border-top:1px solid rgba(255,255,255,0.06);
      background:#10101c;
    ">
      <p style="
        color:#6f6c87;
        font-size:12px;
        margin:0;
      ">
        © ${new Date().getFullYear()} OpenWork · All rights reserved
      </p>
    </div>

  </div>

</body>
</html>
`
  });
};