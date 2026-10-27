import nodemailer from "nodemailer";

function smtpHost() {
  if (process.env.SMTP_HOST) return process.env.SMTP_HOST;
  if (process.env.SMTP_USER?.trim().toLowerCase().endsWith("@gmail.com")) return "smtp.gmail.com";
  return undefined;
}

export function isMailConfigured() {
  return Boolean(smtpHost() && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function createTransporter() {
  const host = smtpHost();
  const port = Number(process.env.SMTP_PORT);
  if (!host || !Number.isInteger(port) || port <= 0 || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error("خدمة البريد غير مهيأة على الخادم. أضف إعدادات SMTP ثم أعد الإرسال.");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export async function verifyMailConnection() {
  await createTransporter().verify();
}

export async function sendOtpEmail(input: { email: string; name: string; code: string; purpose: "verify_email" | "reset_password" }) {
  const transporter = createTransporter();
  const subject = input.purpose === "verify_email" ? "رمز توثيق حساب رفيقي" : "رمز استعادة كلمة مرور رفيقي";
  const action = input.purpose === "verify_email" ? "توثيق بريدك" : "استعادة كلمة مرورك";
  await transporter.sendMail({
    from: process.env.MAIL_FROM || `رفيقي <${process.env.SMTP_USER}>`,
    to: input.email,
    subject,
    text: `مرحبًا ${input.name}، رمز ${action} هو: ${input.code}. تنتهي صلاحيته خلال 10 دقائق. لا تشارك الرمز مع أحد.`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2 style="color:#086c5c">رفيقي</h2><p>مرحبًا ${escapeHtml(input.name)}،</p><p>رمز ${action}:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${input.code}</p><p>تنتهي صلاحيته خلال 10 دقائق. لا تشارك الرمز مع أحد.</p><hr><small>© 2026 فاروق مقبول الوصابي — جميع الحقوق محفوظة</small></div>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}
