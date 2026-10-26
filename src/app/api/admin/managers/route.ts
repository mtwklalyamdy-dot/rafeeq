import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, sessions, supportAgents, users } from "@/db/schema";
import { effectiveRole, errorResponse, isConfiguredAdmin, requireRole } from "@/lib/auth";
import { emailSchema } from "@/lib/validation";

const restorableRoles = new Set(["student", "representative", "support"]);

export async function GET() {
  try {
    await requireRole("admin");
    const rows = await db.select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, isActive: users.isActive, emailVerifiedAt: users.emailVerifiedAt, createdAt: users.createdAt, isAvailable: supportAgents.isAvailable, lastSeenAt: supportAgents.lastSeenAt })
      .from(users).leftJoin(supportAgents, eq(supportAgents.userId, users.id)).orderBy(desc(users.createdAt));
    const managers = rows.filter((row) => effectiveRole(row.email, row.role) === "admin");
    const supportStaff = rows.filter((row) => effectiveRole(row.email, row.role) === "support");
    return Response.json({
      managers: managers.map(({ role: _role, isAvailable: _available, lastSeenAt: _lastSeen, ...manager }) => ({ ...manager, protectedByEnvironment: isConfiguredAdmin(manager.email) })),
      supportStaff: supportStaff.map(({ role: _role, ...staff }) => ({ ...staff, isAvailable: staff.isAvailable || false })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("admin");
    const body = await request.json();
    const parsedEmail = emailSchema.safeParse(body.email);
    if (!parsedEmail.success) return Response.json({ error: "أدخل بريدًا إلكترونيًا صالحًا" }, { status: 400 });

    const target = await db.query.users.findFirst({ where: eq(users.email, parsedEmail.data) });
    if (!target) return Response.json({ error: "لا يوجد حساب بهذا البريد. يجب إنشاء الحساب وتوثيق بريده أولاً؛ لم يتم إنشاء أي حساب تلقائيًا." }, { status: 404 });
    if (target.deletedAt || !target.isActive) return Response.json({ error: "الحساب محذوف أو معطل. فعّله أولاً من إدارة الحسابات." }, { status: 409 });
    if (!target.emailVerifiedAt) return Response.json({ error: "يجب توثيق البريد الإلكتروني قبل منحه صلاحيات الإدارة." }, { status: 409 });
    if (effectiveRole(target.email, target.role) === "admin") return Response.json({ error: "هذا الحساب يملك صلاحيات المدير بالفعل." }, { status: 409 });

    const previousRole = target.role;
    await db.transaction(async (tx) => {
      await tx.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, target.id));
      await tx.delete(sessions).where(eq(sessions.userId, target.id));
      if (previousRole === "support") await tx.update(supportAgents).set({ isAvailable: false }).where(eq(supportAgents.userId, target.id));
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "manager.grant", entityType: "user", entityId: target.id, metadata: { email: target.email, previousRole } });
    });
    return Response.json({ ok: true, message: `مُنحت صلاحيات الإدارة للحساب ${target.email}. لم تتغير كلمة مروره.`, previousRole }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireRole("admin");
    const body = await request.json();
    const userId = String(body.userId || "");
    if (!userId) return Response.json({ error: "معرف المدير مطلوب" }, { status: 400 });
    if (userId === actor.id) return Response.json({ error: "لا يمكنك إزالة صلاحيتك بنفسك. اطلب من مدير آخر تنفيذ ذلك." }, { status: 409 });

    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target || target.role !== "admin") return Response.json({ error: "المدير غير موجود" }, { status: 404 });
    if (isConfiguredAdmin(target.email)) return Response.json({ error: "الحساب محمي بإعداد خادمي ولا يمكن سحب صلاحيته من اللوحة." }, { status: 409 });

    const [activeAdminCount] = await db.select({ value: sql<number>`count(*)::int` }).from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true), isNull(users.deletedAt)));
    if ((activeAdminCount?.value || 0) <= 1) return Response.json({ error: "لا يمكن إزالة آخر مدير نشط في النظام." }, { status: 409 });

    const grantLog = await db.query.auditLogs.findFirst({ where: and(eq(auditLogs.entityId, target.id), eq(auditLogs.action, "manager.grant")), orderBy: [desc(auditLogs.createdAt)] });
    const grantMetadata = grantLog?.metadata as { previousRole?: string } | null;
    const restoredRole = grantMetadata?.previousRole && restorableRoles.has(grantMetadata.previousRole)
      ? grantMetadata.previousRole as "student" | "representative" | "support"
      : "support";

    await db.transaction(async (tx) => {
      await tx.update(users).set({ role: restoredRole, updatedAt: new Date() }).where(eq(users.id, target.id));
      await tx.delete(sessions).where(eq(sessions.userId, target.id));
      if (restoredRole === "support") await tx.insert(supportAgents).values({ userId: target.id, isAvailable: false }).onConflictDoNothing();
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "manager.revoke", entityType: "user", entityId: target.id, metadata: { email: target.email, restoredRole } });
    });
    return Response.json({ ok: true, message: `سُحبت صلاحية المدير وأُعيد الدور السابق للحساب (${restoredRole}).`, restoredRole });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireRole("admin");
    const body = await request.json();
    const userId = String(body.userId || "");
    if (!userId || typeof body.isActive !== "boolean") return Response.json({ error: "معرف المدير وحالة النشاط مطلوبان" }, { status: 400 });
    if (userId === actor.id && !body.isActive) return Response.json({ error: "لا يمكنك تعطيل حسابك الإداري بنفسك." }, { status: 409 });

    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target || target.role !== "admin") return Response.json({ error: "المدير غير موجود" }, { status: 404 });
    if (isConfiguredAdmin(target.email) && !body.isActive) return Response.json({ error: "هذا الحساب محمي بإعداد خادمي ولا يمكن تعطيله من اللوحة." }, { status: 409 });

    if (!body.isActive) {
      const [activeAdminCount] = await db.select({ value: sql<number>`count(*)::int` }).from(users)
        .where(and(eq(users.role, "admin"), eq(users.isActive, true), isNull(users.deletedAt)));
      if ((activeAdminCount?.value || 0) <= 1) return Response.json({ error: "لا يمكن تعطيل آخر مدير نشط." }, { status: 409 });
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ isActive: body.isActive, updatedAt: new Date() }).where(eq(users.id, target.id));
      if (!body.isActive) await tx.delete(sessions).where(eq(sessions.userId, target.id));
      await tx.insert(auditLogs).values({ actorId: actor.id, action: body.isActive ? "manager.activate" : "manager.deactivate", entityType: "user", entityId: target.id, metadata: { email: target.email, isActive: body.isActive } });
    });
    return Response.json({ ok: true, message: body.isActive ? "تم تفعيل المدير." : "تم تعطيل المدير وإبطال جلساته." });
  } catch (error) {
    return errorResponse(error);
  }
}
