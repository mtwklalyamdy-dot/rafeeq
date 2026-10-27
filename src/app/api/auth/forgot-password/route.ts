import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { hashOtp } from "@/lib/auth";
import { isMailConfigured, sendOtpEmail } from "@/lib/mail";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = emailSchema.safeParse((await request.json()).email);
  if (!parsed.success) return Response.json({ error: "البريد الإلكتروني غير صالح" }, { status: 400 });
  const rate = await checkRateLimit("forgot", 3, 15 * 60 * 1000, parsed.data);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  if (!isMailConfigured()) return Response.json({ error: "خدمة البريد غير مهيأة على الخادم حاليًا." }, { status: 503 });
  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data) });
  if (user) {
    const code = String(randomInt(100000, 1000000));
    const codeHash = await hashOtp(user.id, "reset_password", code);
    await db.insert(emailVerifications).values({ userId: user.id, purpose: "reset_password", codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    await sendOtpEmail({ email: user.email, name: user.fullName, code, purpose: "reset_password" });
  }
  return Response.json({ ok: true, message: "إذا كان الحساب موجودًا فسيصل رمز الاستعادة إلى بريده." });
}
