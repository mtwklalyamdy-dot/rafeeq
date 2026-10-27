import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, supportConversations, supportMessages, supportTickets, users } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const conversationId = new URL(request.url).searchParams.get("id");
    if (conversationId) {
      const conversation = await db.query.supportConversations.findFirst({ where: eq(supportConversations.id, conversationId) });
      if (!conversation) return Response.json({ error: "المحادثة غير موجودة" }, { status: 404 });
      const isAdmin = user.role === "admin";
      const isAssignedSupport = user.role === "support" && conversation.assignedAgentId === user.id;
      if (conversation.userId !== user.id && !isAdmin && !isAssignedSupport) return Response.json({ error: "هذه المحادثة ليست مسندة إليك" }, { status: 403 });
      const messages = await db.select({
        id: supportMessages.id,
        conversationId: supportMessages.conversationId,
        senderId: supportMessages.senderId,
        senderName: users.fullName,
        senderRole: users.role,
        body: supportMessages.body,
        fileId: supportMessages.fileId,
        isInternal: supportMessages.isInternal,
        readAt: supportMessages.readAt,
        createdAt: supportMessages.createdAt,
      }).from(supportMessages)
        .innerJoin(users, eq(users.id, supportMessages.senderId))
        .where(and(eq(supportMessages.conversationId, conversationId), (isAdmin || isAssignedSupport) ? undefined : eq(supportMessages.isInternal, false)))
        .orderBy(supportMessages.createdAt);
      return Response.json({ conversation, messages, currentUserId: user.id, transport: "polling" });
    }

    const conversations = user.role === "admin"
      ? await db.select().from(supportConversations).orderBy(desc(supportConversations.updatedAt)).limit(200)
      : user.role === "support"
        ? await db.select().from(supportConversations).where(eq(supportConversations.assignedAgentId, user.id)).orderBy(desc(supportConversations.updatedAt)).limit(200)
        : await db.select().from(supportConversations).where(eq(supportConversations.userId, user.id)).orderBy(desc(supportConversations.updatedAt));
    return Response.json({ conversations, transport: "polling" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (body.conversationId) {
      const conversation = await db.query.supportConversations.findFirst({ where: eq(supportConversations.id, body.conversationId) });
      const isAdmin = user.role === "admin";
      const isAssignedSupport = user.role === "support" && conversation?.assignedAgentId === user.id;
      const isStaff = isAdmin || isAssignedSupport;
      if (!conversation || (conversation.userId !== user.id && !isStaff)) return Response.json({ error: "غير مصرح" }, { status: 403 });
      const messageText = String(body.message || "").trim();
      if (messageText.length < 1 || messageText.length > 5000) return Response.json({ error: "الرسالة مطلوبة وبحد أقصى 5000 حرف" }, { status: 400 });
      const isInternal = Boolean(body.isInternal && isStaff);
      const [message] = await db.transaction(async (tx) => {
        const inserted = await tx.insert(supportMessages).values({ conversationId: conversation.id, senderId: user.id, body: messageText, isInternal }).returning();
        const nextStatus = isInternal ? "in_progress" : isStaff ? "waiting" : "open";
        await tx.update(supportConversations).set({ status: nextStatus, updatedAt: new Date() }).where(eq(supportConversations.id, conversation.id));
        if (conversation.ticketId) await tx.update(supportTickets).set({ status: nextStatus, updatedAt: new Date() }).where(eq(supportTickets.id, conversation.ticketId));
        if (!isInternal && isStaff && user.id !== conversation.userId) {
          await tx.insert(notifications).values({ userId: conversation.userId, title: "رد جديد من دعم رفيقي", body: "وصل رد جديد على طلب الدعم الخاص بك.", kind: "support_reply", resourceId: conversation.ticketId });
        } else if (!isInternal && !isStaff && conversation.assignedAgentId) {
          await tx.insert(notifications).values({ userId: conversation.assignedAgentId, title: "رسالة جديدة من طالب", body: "وصلت رسالة جديدة في محادثة الدعم المسندة إليك.", kind: "support_message", resourceId: conversation.ticketId });
        }
        return inserted;
      });
      return Response.json({ message }, { status: 201 });
    }

    if (!body.ticketId) return Response.json({ error: "اختر تذكرة لبدء المحادثة" }, { status: 400 });
    const isAdmin = user.role === "admin";
    const ticket = await db.query.supportTickets.findFirst({ where: and(eq(supportTickets.id, body.ticketId), isAdmin || user.role === "support" ? undefined : eq(supportTickets.userId, user.id)) });
    if (!ticket) return Response.json({ error: "التذكرة غير موجودة" }, { status: 404 });
    if (user.role === "support" && ticket.assignedAgentId !== user.id) return Response.json({ error: "استلم التذكرة من صندوق الدعم قبل فتح محادثتها." }, { status: 403 });
    const existing = await db.query.supportConversations.findFirst({ where: eq(supportConversations.ticketId, ticket.id) });
    if (existing) return Response.json({ conversation: existing });
    const [conversation] = await db.insert(supportConversations).values({ ticketId: ticket.id, userId: ticket.userId, assignedAgentId: ticket.assignedAgentId }).returning();
    return Response.json({ conversation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
