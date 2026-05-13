import nodemailer from "nodemailer";

export async function sendVerificationEmail({
  to,
  displayName,
  verificationUrl,
}: {
  to: string;
  displayName: string;
  verificationUrl: string;
}) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Verify your TradeLab account",
    html: `
      <div style="font-family: Arial, sans-serif; background:#0b1020; color:#f8fafc; padding:24px;">
        <div style="max-width:560px; margin:0 auto; background:#111827; border:1px solid #243047; border-radius:16px; padding:24px;">
          <h1 style="margin:0 0 16px; color:#ffffff;">Welcome to TradeLab</h1>
          <p>Hello ${displayName || "there"},</p>
          <p>Please verify your email address to activate your TradeLab account.</p>
          <p style="margin:24px 0;">
            <a href="${verificationUrl}"
               style="background:#38bdf8; color:#020617; padding:12px 18px; border-radius:10px; text-decoration:none; font-weight:bold;">
              Verify Email
            </a>
          </p>
          <p style="color:#cbd5e1;">If the button does not work, copy this link:</p>
          <p style="word-break:break-all; color:#93c5fd;">${verificationUrl}</p>
        </div>
      </div>
    `,
  });
}