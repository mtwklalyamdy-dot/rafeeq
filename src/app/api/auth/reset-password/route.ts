import bcrypt from "bcryptjs";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, sessions, users } from "@/db/schema";
import { verifyOtp } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { firstZodError } from "@/lib/utils";
import { resetPasswordSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = resetPasswordSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
  const rate = await checkRateLimit("reset-password", 5, 15 * 60 * 1000, parsed.data.email);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!user) return Response.json({ error: "الرمز غير صحيح أو منتهي" }, { status: 400 });
  const record = await db.query.emailVerifications.findFirst({ where: and(eq(emailVerifications.userId, user.id), eq(emailVerifications.purpose, "reset_password"), isNull(emailVerifications.usedAt)), orderBy: [desc(emailVerifications.createdAt)] });
  if (!record || record.expiresAt <= new Date() || record.attempts >= record.maxAttempts) return Response.json({ error: "الرمز غير صحيح أو منتهي" }, { status: 400 });
  const valid = await verifyOtp(record.codeHash, user.id, "reset_password", parsed.data.code);
  if (!valid) {
    await db.update(emailVerifications).set({ attempts: record.attempts + 1 }).where(eq(emailVerifications.id, record.id));
    return Response.json({ error: "الرمز غير صحيح" }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.transaction(async (tx) => {
    await tx.update(emailVerifications).set({ usedAt: new Date() }).where(eq(emailVerifications.id, record.id));
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  return Response.json({ ok: true, message: "تم تغيير كلمة المرور. سجّل الدخول بكلمتك الجديدة." });
}
