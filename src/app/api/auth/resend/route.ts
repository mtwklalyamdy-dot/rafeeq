import { randomInt } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { hashOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mail";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json();
  const email = emailSchema.safeParse(body.email);
  const purpose = body.purpose === "reset_password" ? "reset_password" : "verify_email";
  if (!email.success) return Response.json({ error: "البريد الإلكتروني غير صالح" }, { status: 400 });
  const rate = await checkRateLimit("otp-resend", 3, 15 * 60 * 1000, `${email.data}:${purpose}`);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  const user = await db.query.users.findFirst({ where: eq(users.email, email.data) });
  if (!user) return Response.json({ ok: true, message: "إذا كان الحساب موجودًا فسيصل الرمز إلى بريده." });
  const latest = await db.query.emailVerifications.findFirst({ where: and(eq(emailVerifications.userId, user.id), eq(emailVerifications.purpose, purpose)), orderBy: [desc(emailVerifications.createdAt)] });
  if (latest && Date.now() - latest.lastSentAt.getTime() < 60_000) return Response.json({ error: "انتظر دقيقة قبل إعادة الإرسال" }, { status: 429 });
  const code = String(randomInt(100000, 1000000));
  const codeHash = await hashOtp(user.id, purpose, code);
  await db.insert(emailVerifications).values({ userId: user.id, purpose, codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  try {
    await sendOtpEmail({ email: user.email, name: user.fullName, code, purpose });
    return Response.json({ ok: true, message: "أُرسل رمز جديد إلى بريدك." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر إرسال الرمز" }, { status: 503 });
  }
}
