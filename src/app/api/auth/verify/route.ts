import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { createSession, verifyOtp } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { firstZodError } from "@/lib/utils";
import { verifySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = verifySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
  const rate = await checkRateLimit("verify", 10, 15 * 60 * 1000, `${parsed.data.email}:${parsed.data.purpose}`);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!user) return Response.json({ error: "رمز التحقق غير صحيح أو منتهي" }, { status: 400 });
  const record = await db.query.emailVerifications.findFirst({
    where: and(eq(emailVerifications.userId, user.id), eq(emailVerifications.purpose, parsed.data.purpose), isNull(emailVerifications.usedAt)),
    orderBy: [desc(emailVerifications.createdAt)],
  });
  if (!record || record.expiresAt <= new Date() || record.attempts >= record.maxAttempts) {
    return Response.json({ error: "رمز التحقق غير صحيح أو منتهي" }, { status: 400 });
  }
  const valid = await verifyOtp(record.codeHash, user.id, parsed.data.purpose, parsed.data.code);
  if (!valid) {
    await db.update(emailVerifications).set({ attempts: record.attempts + 1 }).where(eq(emailVerifications.id, record.id));
    return Response.json({ error: "رمز التحقق غير صحيح", attemptsRemaining: Math.max(0, record.maxAttempts - record.attempts - 1) }, { status: 400 });
  }
  if (parsed.data.purpose === "verify_email") {
    await db.transaction(async (tx) => {
      await tx.update(emailVerifications).set({ usedAt: new Date() }).where(and(eq(emailVerifications.id, record.id), isNull(emailVerifications.usedAt)));
      await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    });
    if (user.role !== "representative") await createSession(user.id);
  }
  return Response.json({ ok: true, role: user.role, requiresPasswordReset: parsed.data.purpose === "reset_password" });
}
