const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST) {
    console.warn('SMTP not configured — password reset emails will be logged to console');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendPasswordResetEmail(to, code) {
  const transport = getTransporter();
  const subject = 'T Bill — Password Reset Code';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">T Bill</h2>
      <p>You requested a password reset. Use the code below:</p>
      <div style="background: #f3f4f6; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
      </div>
      <p style="color: #6b7280; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;

  if (transport) {
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'noreply@tbill.com',
      to,
      subject,
      html,
    });
    console.log(`Password reset email sent to ${to}`);
  } else {
    // No SMTP — log the code to console for development
    console.log(`\n===== PASSWORD RESET CODE =====`);
    console.log(`Email: ${to}`);
    console.log(`Code:  ${code}`);
    console.log(`================================\n`);
  }
}

module.exports = { sendPasswordResetEmail };
