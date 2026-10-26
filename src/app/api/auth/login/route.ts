import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { representatives, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { effectiveRole } from "@/lib/admin-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { firstZodError } from "@/lib/utils";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    const rate = await checkRateLimit("login", 10, 15 * 60 * 1000, parsed.data.email);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
    if (!user || user.deletedAt || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return Response.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    if (!user.emailVerifiedAt) return Response.json({ error: "وثّق بريدك الإلكتروني قبل تسجيل الدخول", requiresVerification: true }, { status: 403 });
    const role = effectiveRole(user.email, user.role);
    if (raw.portal === "representative" && role !== "representative") {
      return Response.json({ error: "هذه البوابة مخصصة للمندوبين المعتمدين" }, { status: 403 });
    }
    if (role === "representative") {
      const rep = await db.query.representatives.findFirst({ where: eq(representatives.userId, user.id) });
      if (!rep || rep.approvalStatus !== "approved") return Response.json({ error: "حساب المندوب بانتظار اعتماد الإدارة", pendingApproval: true }, { status: 403 });
    }
    await createSession(user.id);
    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    return Response.json({ ok: true, role });
  } catch {
    return Response.json({ error: "تعذر تسجيل الدخول حاليًا" }, { status: 500 });
  }
}
