import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, supportAgents, supportTickets, users } from "@/db/schema";
import { errorResponse, requireRole, requireUser } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "admin" || user.role === "support") {
      const tickets = await db.select({
        id: supportTickets.id,
        userId: supportTickets.userId,
        userName: users.fullName,
        userEmail: users.email,
        assignedAgentId: supportTickets.assignedAgentId,
        type: supportTickets.type,
        subject: supportTickets.subject,
        description: supportTickets.description,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
      }).from(supportTickets)
        .innerJoin(users, eq(users.id, supportTickets.userId))
        .where(user.role === "support" ? or(isNull(supportTickets.assignedAgentId), eq(supportTickets.assignedAgentId, user.id)) : undefined)
        .orderBy(desc(supportTickets.updatedAt)).limit(200);
      return Response.json({ tickets });
    }
    const tickets = await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, user.id))
      .orderBy(desc(supportTickets.updatedAt));
    return Response.json({ tickets });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const rate = await checkRateLimit("support-ticket", 5, 60 * 60 * 1000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  try {
    const user = await requireUser(); const body = await request.json();
    if (user.role === "admin" || user.role === "support") return Response.json({ error: "إنشاء تذكرة دعم متاح لحساب الطالب فقط" }, { status: 403 });
    if (!body.type?.trim() || !body.subject?.trim() || !body.description?.trim()) return Response.json({ error: "نوع المشكلة والعنوان والوصف مطلوبة" }, { status: 400 });
    const [ticket] = await db.insert(supportTickets).values({ userId: user.id, type: body.type.trim(), subject: body.subject.trim(), description: body.description.trim() }).returning();
    return Response.json({ ticket }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const agent = await requireRole("admin", "support");
    const body = await request.json();
    const ticketId = String(body.ticketId || "");
    if (!ticketId) return Response.json({ error: "معرف التذكرة مطلوب" }, { status: 400 });
    const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, ticketId) });
    if (!ticket) return Response.json({ error: "التذكرة غير موجودة" }, { status: 404 });

    if (body.action === "claim") {
      if (agent.role !== "support") return Response.json({ error: "استلام التذاكر متاح لموظف الدعم فقط" }, { status: 403 });
      if (ticket.assignedAgentId && ticket.assignedAgentId !== agent.id) return Response.json({ error: "التذكرة مستلمة من موظف آخر" }, { status: 409 });
      await db.transaction(async (tx) => {
        await tx.insert(supportAgents).values({ userId: agent.id, isAvailable: true, lastSeenAt: new Date() }).onConflictDoNothing();
        await tx.update(supportTickets).set({ assignedAgentId: agent.id, status: "in_progress", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
        await tx.insert(auditLogs).values({ actorId: agent.id, action: "support.ticket.claim", entityType: "support_ticket", entityId: ticket.id, metadata: { assignedAgentId: agent.id } });
      });
      return Response.json({ ok: true, message: "استلمت التذكرة" });
    }

    const allowedStatuses = ["open", "waiting", "in_progress", "resolved", "closed"] as const;
    if (!allowedStatuses.includes(body.status)) return Response.json({ error: "حالة التذكرة غير صالحة" }, { status: 400 });
    if (agent.role === "support" && ticket.assignedAgentId !== agent.id) return Response.json({ error: "استلم التذكرة قبل تغيير حالتها" }, { status: 403 });
    await db.transaction(async (tx) => {
      await tx.update(supportTickets).set({ status: body.status, updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
      await tx.insert(auditLogs).values({ actorId: agent.id, action: "support.ticket.status", entityType: "support_ticket", entityId: ticket.id, metadata: { status: body.status } });
    });
    return Response.json({ ok: true, message: "تم تحديث حالة التذكرة" });
  } catch (error) { return errorResponse(error); }
}
