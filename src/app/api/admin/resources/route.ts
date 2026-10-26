import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  auditLogs,
  assignments,
  colleges,
  communityCategories,
  communityComments,
  communityPosts,
  courseContents,
  courses,
  exams,
  emailVerifications,
  levels,
  notifications,
  profiles,
  representativeAssignments,
  representatives,
  semesters,
  sessions,
  supportAgents,
  supportConversations,
  supportMessages,
  supportTickets,
  telegramChannels,
  users,
  appSettings,
} from "@/db/schema";
import { errorResponse, isConfiguredAdmin, requireRole } from "@/lib/auth";
import { emailSchema, passwordSchema } from "@/lib/validation";

const editableRoles = new Set(["student", "representative", "support"]);
const ticketStatuses = new Set(["open", "waiting", "in_progress", "resolved", "closed"]);

export async function POST(request: Request) {
  try {
    const admin = await requireRole("admin");
    const body = await request.json();
    let result: unknown;
    let auditMetadata: Record<string, unknown> = {};

    if (body.action === "college.create") {
      if (!body.nameAr?.trim() || !body.university?.trim()) return Response.json({ error: "اسم الكلية والجامعة مطلوبان" }, { status: 400 });
      [result] = await db.insert(colleges).values({ nameAr: body.nameAr.trim(), nameEn: body.nameEn?.trim() || null, university: body.university.trim() }).returning();
    } else if (body.action === "level.create") {
      [result] = await db.insert(levels).values({ nameAr: String(body.nameAr || "").trim(), sortOrder: Number(body.sortOrder) }).returning();
    } else if (body.action === "semester.create") {
      [result] = await db.insert(semesters).values({ nameAr: String(body.nameAr || "").trim(), academicYear: String(body.academicYear || "").trim(), startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null }).returning();
    } else if (body.action === "category.create") {
      if (!/^[a-z0-9-]+$/.test(body.slug || "")) return Response.json({ error: "المعرف يجب أن يكون إنجليزيًا صغيرًا" }, { status: 400 });
      [result] = await db.insert(communityCategories).values({ nameAr: String(body.nameAr || "").trim(), slug: body.slug, description: body.description?.trim() || null }).returning();
    } else if (body.action === "telegram.create") {
      const url = body.url?.trim() || null;
      if (url && !/^https:\/\/t\.me\/[A-Za-z0-9_]{5,}$/.test(url)) return Response.json({ error: "رابط Telegram غير صالح" }, { status: 400 });
      [result] = await db.insert(telegramChannels).values({ levelId: body.levelId, title: String(body.title || "").trim(), description: body.description?.trim() || null, url }).returning();
    } else if (body.action === "announcement.create") {
      if (!body.title?.trim() || !body.body?.trim()) return Response.json({ error: "عنوان الإعلان ومحتواه مطلوبان" }, { status: 400 });
      [result] = await db.insert(announcements).values({ authorId: admin.id, title: body.title.trim(), body: body.body.trim(), targetCollegeId: body.targetCollegeId || null, targetLevelId: body.targetLevelId || null, targetGroup: body.targetGroup?.trim() || null, isPublished: Boolean(body.publish), publishedAt: body.publish ? new Date() : null }).returning();
    } else if (body.action === "representative.approve" || body.action === "representative.suspend") {
      const status = body.action === "representative.approve" ? "approved" : "suspended";
      const representative = await db.query.representatives.findFirst({ where: eq(representatives.userId, body.userId) });
      if (!representative) return Response.json({ error: "حساب المندوب غير موجود" }, { status: 404 });
      [result] = await db.update(representatives).set({ approvalStatus: status, approvedBy: status === "approved" ? admin.id : null, approvedAt: status === "approved" ? new Date() : null, updatedAt: new Date() }).where(eq(representatives.userId, body.userId)).returning();
      await db.insert(notifications).values({ userId: body.userId, title: status === "approved" ? "تم اعتماد حساب المندوب" : "تم إيقاف صلاحيات المندوب", body: status === "approved" ? "يمكنك الآن دخول لوحة المندوب." : "راجع الإدارة لمعرفة التفاصيل.", kind: "representative_status" });
      auditMetadata = { targetUserId: body.userId, status };
    } else if (body.action === "representative.assignCourse") {
      const representative = await db.query.representatives.findFirst({ where: eq(representatives.userId, body.userId) });
      if (!representative || representative.approvalStatus !== "approved") return Response.json({ error: "يجب اعتماد المندوب أولًا" }, { status: 409 });
      [result] = await db.insert(representativeAssignments).values({ representativeId: body.userId, courseId: body.courseId, canPublishDirectly: Boolean(body.canPublishDirectly) }).onConflictDoUpdate({ target: [representativeAssignments.representativeId, representativeAssignments.courseId], set: { canPublishDirectly: Boolean(body.canPublishDirectly) } }).returning();
      auditMetadata = { targetUserId: body.userId, courseId: body.courseId };
    } else if (body.action === "user.update") {
      const target = await db.query.users.findFirst({ where: eq(users.id, body.userId) });
      if (!target) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
      const fullName = String(body.fullName || "").trim();
      const protectedAdmin = target.role === "admin" || isConfiguredAdmin(target.email);
      const parsedEmail = emailSchema.safeParse(protectedAdmin ? target.email : body.email);
      if (fullName.length < 3 || !parsedEmail.success) return Response.json({ error: "الاسم أو البريد غير صالح" }, { status: 400 });
      const duplicate = await db.query.users.findFirst({ where: eq(users.email, parsedEmail.data), columns: { id: true } });
      if (duplicate && duplicate.id !== target.id) return Response.json({ error: "البريد مستخدم في حساب آخر" }, { status: 409 });
      const requestedRole = String(body.role || target.role);
      const nextRole = protectedAdmin ? target.role : editableRoles.has(requestedRole) ? requestedRole as "student" | "representative" | "support" : target.role;
      const isActive = protectedAdmin ? target.isActive : body.isActive !== false;
      const verifiedAt = protectedAdmin ? target.emailVerifiedAt : body.emailVerified === true ? target.emailVerifiedAt || new Date() : null;

      await db.transaction(async (tx) => {
        await tx.update(users).set({ fullName, email: parsedEmail.data, role: nextRole, isActive, emailVerifiedAt: verifiedAt, updatedAt: new Date() }).where(eq(users.id, target.id));
        const profile = await tx.query.profiles.findFirst({ where: eq(profiles.userId, target.id) });
        if (profile) {
          await tx.update(profiles).set({
            university: String(body.university || profile.university).trim(),
            studentNumber: body.studentNumber?.trim() || null,
            groupName: body.groupName?.trim() || null,
            collegeId: body.collegeId || null,
            departmentId: body.departmentId || null,
            levelId: body.levelId || null,
            semesterId: body.semesterId || null,
            updatedAt: new Date(),
          }).where(eq(profiles.userId, target.id));
        }
        if (nextRole === "representative") {
          await tx.insert(representatives).values({ userId: target.id, levelId: body.levelId || profile?.levelId || null, departmentId: body.departmentId || profile?.departmentId || null, semesterId: body.semesterId || profile?.semesterId || null, groupName: body.groupName?.trim() || profile?.groupName || null, approvalStatus: "pending" }).onConflictDoNothing();
        } else if (target.role === "representative") {
          await tx.update(representatives).set({ approvalStatus: "suspended", updatedAt: new Date() }).where(eq(representatives.userId, target.id));
        }
        if (nextRole === "support") {
          await tx.insert(supportAgents).values({ userId: target.id, isAvailable: false }).onConflictDoNothing();
        } else if (target.role === "support") {
          await tx.update(supportAgents).set({ isAvailable: false }).where(eq(supportAgents.userId, target.id));
        }
        await tx.delete(sessions).where(eq(sessions.userId, target.id));
      });
      result = { id: target.id, role: nextRole, isActive, emailVerified: Boolean(verifiedAt) };
      auditMetadata = { targetUserId: target.id, fields: ["identity", "profile", "role", "status"] };
    } else if (body.action === "user.setPassword") {
      const target = await db.query.users.findFirst({ where: eq(users.id, body.userId), columns: { id: true } });
      if (!target) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
      const parsedPassword = passwordSchema.safeParse(body.password);
      if (!parsedPassword.success) return Response.json({ error: parsedPassword.error.issues[0]?.message || "كلمة المرور غير صالحة" }, { status: 400 });
      const passwordHash = await bcrypt.hash(parsedPassword.data, 12);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, target.id));
        await tx.delete(sessions).where(eq(sessions.userId, target.id));
        await tx.delete(emailVerifications).where(and(eq(emailVerifications.userId, target.id), eq(emailVerifications.purpose, "reset_password")));
      });
      result = { id: target.id, passwordChanged: true };
      auditMetadata = { targetUserId: target.id, passwordChanged: true };
    } else if (body.action === "supportAgent.availability") {
      const target = await db.query.users.findFirst({ where: eq(users.id, body.userId) });
      if (!target || target.role !== "support") return Response.json({ error: "موظف الدعم غير موجود أو لم يعد يملك دور الدعم" }, { status: 404 });
      if (typeof body.isAvailable !== "boolean") return Response.json({ error: "حالة التوفر غير صالحة" }, { status: 400 });
      await db.insert(supportAgents).values({ userId: target.id, isAvailable: body.isAvailable, lastSeenAt: null }).onConflictDoUpdate({ target: supportAgents.userId, set: { isAvailable: body.isAvailable } });
      result = { userId: target.id, isAvailable: body.isAvailable };
      auditMetadata = { targetUserId: target.id, isAvailable: body.isAvailable };
    } else if (body.action === "course.update") {
      const target = await db.query.courses.findFirst({ where: eq(courses.id, body.id) });
      if (!target) return Response.json({ error: "المادة غير موجودة" }, { status: 404 });
      const [updated] = await db.update(courses).set({
        nameAr: body.nameAr === undefined ? target.nameAr : String(body.nameAr).trim(),
        description: body.description === undefined ? target.description : String(body.description).trim() || null,
        isActive: body.isActive === undefined ? target.isActive : Boolean(body.isActive),
        creditHours: body.creditHours === undefined ? target.creditHours : Math.min(12, Math.max(0, Number(body.creditHours) || 0)),
        updatedAt: new Date(),
      }).where(eq(courses.id, target.id)).returning();
      result = updated; auditMetadata = { courseId: target.id, isActive: updated.isActive };
    } else if (body.action === "course.update") {
      const target = await db.query.courses.findFirst({ where: eq(courses.id, body.id) });
      if (!target) return Response.json({ error: "المقرر غير موجود" }, { status: 404 });
      const [updated] = await db.update(courses).set({
        nameAr: body.nameAr === undefined ? target.nameAr : String(body.nameAr).trim(),
        nameEn: body.nameEn === undefined ? target.nameEn : String(body.nameEn).trim() || null,
        description: body.description === undefined ? target.description : String(body.description).trim() || null,
        creditHours: body.creditHours === undefined ? target.creditHours : Math.min(12, Math.max(0, Number(body.creditHours) || 0)),
        isActive: body.isActive === undefined ? target.isActive : Boolean(body.isActive),
        updatedAt: new Date(),
      }).where(eq(courses.id, target.id)).returning();
      result = updated;
      auditMetadata = { courseId: target.id, isActive: updated.isActive };
    } else if (body.action === "content.update") {
      const target = await db.query.courseContents.findFirst({ where: eq(courseContents.id, body.id) });
      if (!target) return Response.json({ error: "المحتوى غير موجود" }, { status: 404 });
      const allowedStatuses = new Set(["draft", "pending", "published", "rejected", "archived"]);
      if (body.status !== undefined && !allowedStatuses.has(String(body.status))) return Response.json({ error: "حالة المحتوى غير صالحة" }, { status: 400 });
      const [updated] = await db.update(courseContents).set({
        title: body.title === undefined ? target.title : String(body.title).trim(),
        description: body.description === undefined ? target.description : String(body.description).trim() || null,
        status: body.status === undefined ? target.status : body.status,
        publishedAt: body.status === "published" ? target.publishedAt || new Date() : target.publishedAt,
        updatedAt: new Date(),
      }).where(eq(courseContents.id, target.id)).returning();
      result = updated; auditMetadata = { contentId: target.id, status: updated.status };
    } else if (body.action === "assignment.update") {
      const target = await db.query.assignments.findFirst({ where: eq(assignments.id, body.id) });
      if (!target) return Response.json({ error: "الواجب غير موجود" }, { status: 404 });
      const allowedStatuses = new Set(["draft", "pending", "published", "closed"]);
      if (body.status !== undefined && !allowedStatuses.has(String(body.status))) return Response.json({ error: "حالة الواجب غير صالحة" }, { status: 400 });
      const [updated] = await db.update(assignments).set({ title: body.title === undefined ? target.title : String(body.title).trim(), description: body.description === undefined ? target.description : String(body.description).trim(), status: body.status === undefined ? target.status : body.status, updatedAt: new Date() }).where(eq(assignments.id, target.id)).returning();
      result = updated; auditMetadata = { assignmentId: target.id, status: updated.status };
    } else if (body.action === "exam.update") {
      const target = await db.query.exams.findFirst({ where: eq(exams.id, body.id) });
      if (!target) return Response.json({ error: "الاختبار غير موجود" }, { status: 404 });
      const [updated] = await db.update(exams).set({ title: body.title === undefined ? target.title : String(body.title).trim(), isPublished: body.isPublished === undefined ? target.isPublished : Boolean(body.isPublished), updatedAt: new Date() }).where(eq(exams.id, target.id)).returning();
      result = updated; auditMetadata = { examId: target.id, isPublished: updated.isPublished };
    } else if (body.action === "announcement.update") {
      const target = await db.query.announcements.findFirst({ where: eq(announcements.id, body.id) });
      if (!target) return Response.json({ error: "الإعلان غير موجود" }, { status: 404 });
      const [updated] = await db.update(announcements).set({ title: body.title === undefined ? target.title : String(body.title).trim(), body: body.body === undefined ? target.body : String(body.body).trim(), isPublished: body.isPublished === undefined ? target.isPublished : Boolean(body.isPublished), updatedAt: new Date() }).where(eq(announcements.id, target.id)).returning();
      result = updated; auditMetadata = { announcementId: target.id, isPublished: updated.isPublished };
    } else if (body.action === "community.moderatePost") {
      const target = await db.query.communityPosts.findFirst({ where: eq(communityPosts.id, body.id) });
      if (!target) return Response.json({ error: "المنشور غير موجود" }, { status: 404 });
      const allowedStatuses = new Set(["new", "waiting", "answered", "solved", "hidden"]);
      if (!allowedStatuses.has(String(body.status))) return Response.json({ error: "حالة المنشور غير صالحة" }, { status: 400 });
      const [updated] = await db.update(communityPosts).set({ status: body.status, updatedAt: new Date() }).where(eq(communityPosts.id, target.id)).returning();
      result = updated; auditMetadata = { postId: target.id, status: updated.status };
    } else if (body.action === "community.moderateComment") {
      const target = await db.query.communityComments.findFirst({ where: eq(communityComments.id, body.id) });
      if (!target) return Response.json({ error: "التعليق غير موجود" }, { status: 404 });
      const [updated] = await db.update(communityComments).set({ isHidden: Boolean(body.isHidden), updatedAt: new Date() }).where(eq(communityComments.id, target.id)).returning();
      result = updated; auditMetadata = { commentId: target.id, isHidden: updated.isHidden };
    } else if (body.action === "ticket.update") {
      if (!ticketStatuses.has(body.status)) return Response.json({ error: "حالة التذكرة غير صالحة" }, { status: 400 });
      [result] = await db.update(supportTickets).set({ status: body.status, updatedAt: new Date() }).where(eq(supportTickets.id, body.ticketId)).returning();
      if (!result) return Response.json({ error: "التذكرة غير موجودة" }, { status: 404 });
      auditMetadata = { ticketId: body.ticketId, status: body.status };
    } else if (body.action === "support.reply") {
      const reply = String(body.message || "").trim();
      if (reply.length < 2 || reply.length > 5000) return Response.json({ error: "اكتب ردًا واضحًا لا يتجاوز 5000 حرف" }, { status: 400 });
      const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, body.ticketId) });
      if (!ticket) return Response.json({ error: "التذكرة غير موجودة" }, { status: 404 });
      result = await db.transaction(async (tx) => {
        let conversation = await tx.query.supportConversations.findFirst({ where: eq(supportConversations.ticketId, ticket.id) });
        if (!conversation) [conversation] = await tx.insert(supportConversations).values({ ticketId: ticket.id, userId: ticket.userId, status: "waiting" }).returning();
        const [message] = await tx.insert(supportMessages).values({ conversationId: conversation.id, senderId: admin.id, body: reply, isInternal: false }).returning();
        await tx.update(supportConversations).set({ status: "waiting", updatedAt: new Date() }).where(eq(supportConversations.id, conversation.id));
        await tx.update(supportTickets).set({ status: "waiting", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
        await tx.insert(notifications).values({ userId: ticket.userId, title: "رد جديد من دعم رفيقي", body: `وصل رد على تذكرتك: ${ticket.subject}`, kind: "support_reply", resourceId: ticket.id });
        return { conversationId: conversation.id, messageId: message.id };
      });
      auditMetadata = { ticketId: ticket.id, replied: true };
    } else if (body.action === "database.deleteRow") {
      const table = String(body.table || "");
      const deletableTables = new Set(["calendar_events", "notes", "telegram_channels", "academic_terms"]);
      if (!deletableTables.has(table)) return Response.json({ error: "هذا الجدول لا يسمح بالحذف من مستكشف قاعدة البيانات؛ استخدم إدارة العنصر المخصصة." }, { status: 403 });
      const primaryKeyField = body.primaryKeyField === "key" ? "key" : body.primaryKeyField === "id" ? "id" : "";
      const primaryKeyValue = String(body.primaryKeyValue || "");
      if (!primaryKeyField || !primaryKeyValue || primaryKeyValue.length > 240) return Response.json({ error: "المفتاح الأساسي غير صالح" }, { status: 400 });
      const deleted = await db.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(primaryKeyField)} = ${primaryKeyValue} RETURNING ${sql.identifier(primaryKeyField)}`);
      if (!deleted.rows.length) return Response.json({ error: "السجل غير موجود" }, { status: 404 });
      result = { deleted: true, table, field: primaryKeyField, value: primaryKeyValue };
      auditMetadata = { table, field: primaryKeyField };
    } else if (body.action === "menu.save") {
      if (!Array.isArray(body.items) || body.items.length > 40) return Response.json({ error: "قائمة الخيارات غير صالحة أو تتجاوز الحد" }, { status: 400 });
      const validRoutes = new Set(["/dashboard", "/courses", "/library", "/assignments", "/exams", "/grades", "/calendar", "/notes", "/offline", "/community", "/ai", "/support", "/tools", "/dictionary", "/telegram", "/settings", "/about", "/download"]);
      const validCategories = new Set(["الدراسة", "التنظيم", "الذكاء الاصطناعي", "مجتمع رفيقي", "أدوات ومصادر", "الدعم والإعدادات"]);
      const validRoles = new Set(["student", "representative", "support", "admin"]);
      const items = [];
      for (const raw of body.items) {
        const href = String(raw.href || "");
        const label = String(raw.label || "").trim();
        const category = String(raw.category || "");
        const roles = Array.isArray(raw.roles) ? raw.roles.filter((role: string) => validRoles.has(role)) : ["student", "representative", "support", "admin"];
        if (!validRoutes.has(href) || !label || label.length > 80 || !validCategories.has(category) || !roles.length) return Response.json({ error: "أحد عناصر القائمة غير صالح؛ اختر مسارًا داخليًا موجودًا وفئة وأدوارًا صحيحة." }, { status: 400 });
        items.push({ id: String(raw.id || randomUUID()), href, label, category, icon: String(raw.icon || "•").slice(0, 12), roles, order: Math.max(0, Number(raw.order) || 0), enabled: raw.enabled !== false });
      }
      await db.insert(appSettings).values({ key: "main_menu", value: items, isPublic: true, updatedBy: admin.id, updatedAt: new Date() }).onConflictDoUpdate({ target: appSettings.key, set: { value: items, isPublic: true, updatedBy: admin.id, updatedAt: new Date() } });
      result = { items };
      auditMetadata = { itemCount: items.length };
    } else if (body.action === "feature_flags.save") {
      const validFlags = new Set(["ai", "community", "academicContent", "offline", "tools", "support", "telegram", "dictionary"]);
      const incoming = body.flags;
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return Response.json({ error: "إعدادات الميزات غير صالحة" }, { status: 400 });
      const current = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "feature_flags") });
      const flags = { ...((current?.value as Record<string, boolean>) || {}) };
      for (const [key, value] of Object.entries(incoming)) {
        if (!validFlags.has(key) || typeof value !== "boolean") return Response.json({ error: "اسم ميزة أو قيمة غير صالحة" }, { status: 400 });
        flags[key] = value;
      }
      await db.insert(appSettings).values({ key: "feature_flags", value: flags, isPublic: true, updatedBy: admin.id, updatedAt: new Date() }).onConflictDoUpdate({ target: appSettings.key, set: { value: flags, isPublic: true, updatedBy: admin.id, updatedAt: new Date() } });
      result = { flags };
      auditMetadata = { changedFlags: Object.keys(incoming) };
    } else if (body.action === "app.updateVersion") {
      const version = String(body.version || "").trim();
      const changelog = String(body.changelog || "").trim();
      const urlStr = String(body.url || "").trim();
      
      if (!version || !changelog || !urlStr) {
        return Response.json({ error: "الرجاء تعبئة رقم الإصدار وسجل التغييرات ورابط التحميل" }, { status: 400 });
      }

      // Read existing updates list
      const existing = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "app_updates") });
      const updates = existing ? (existing.value as any[]) : [];
      
      if (updates.some((u: any) => u.version === version)) {
        return Response.json({ error: "هذا الإصدار مسجل بالفعل" }, { status: 409 });
      }

      const newUpdate = { version, changelog, url: urlStr, createdAt: new Date().toISOString() };
      updates.unshift(newUpdate);

      // Save back to DB
      await db.insert(appSettings).values({
        key: "app_updates",
        value: updates,
        isPublic: true,
        updatedBy: admin.id,
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: appSettings.key,
        set: { value: updates, updatedBy: admin.id, updatedAt: new Date() }
      });

      // Broadcast a notification to all active students/users about this update
      const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true));
      if (allUsers.length > 0) {
        await db.insert(notifications).values(allUsers.map((u) => ({
          userId: u.id,
          title: `تحديث جديد متوفر: ${version}`,
          body: `ملخص التغييرات: ${changelog}`,
          kind: "app_update",
          resourceId: null
        })));
      }

      result = { version, changelog, url: urlStr };
      auditMetadata = { version };
    } else if (body.action === "app.syncTelegram") {
      // 1. Fetch public Telegram channel HTML web preview
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      let html = "";
      try {
        const response = await fetch("https://t.me/s/rafeeqybeta", {
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
          },
          signal: controller.signal
        });
        html = await response.text();
      } catch (fetchError) {
        return Response.json({ 
          error: "تعذر الاتصال بـ Telegram حالياً لقراءة التحديثات التلقائية. يرجى المحاولة لاحقاً." 
        }, { status: 502 });
      } finally {
        clearTimeout(timeout);
      }

      // 2. Parse last message container from public preview
      const matches = [...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
      if (matches.length === 0) {
        return Response.json({ 
          error: "لم يُعثر على أي منشورات عامة في قناة rafeeqybeta حالياً للتزامن معها." 
        }, { status: 404 });
      }

      // Get the last post (at the bottom)
      const lastMessageHtml = matches[matches.length - 1][1];
      const lastMessageText = lastMessageHtml.replace(/<[^>]*>/g, "").trim();

      // 3. Extract version code (e.g. v1.0.2 or 1.0.3)
      const versionMatch = lastMessageText.match(/v?([0-9]+\.[0-9]+\.[0-9]+)/i);
      if (!versionMatch) {
        result = {
          synced: true,
          message: "تمت المزامنة بنجاح: تم قراءة آخر منشور بالقناة ولكن لا يحتوي على صيغة رقم إصدار جديد (مثال: v1.0.2).",
          lastPostText: lastMessageText.slice(0, 200) + "..."
        };
      } else {
        const version = versionMatch[1];

        // 4. Load existing updates list from DB
        const existing = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "app_updates") });
        const updates = existing ? (existing.value as any[]) : [];

        // Check if version is already registered
        if (updates.some((u: any) => u.version === version)) {
          result = {
            synced: true,
            message: `تمت المزامنة بنجاح: الإصدار الأخير بالقناة (${version}) مسجل مسبقاً وتنبيهاته مرسلة لجميع الطلاب.`,
            version,
            lastPostText: lastMessageText.slice(0, 200) + "..."
          };
        } else {
          // 5. Register new update automatically
          const newUpdate = {
            version,
            changelog: lastMessageText,
            url: "https://t.me/rafeeqybeta",
            createdAt: new Date().toISOString()
          };
          updates.unshift(newUpdate);

          await db.insert(appSettings).values({
            key: "app_updates",
            value: updates,
            isPublic: true,
            updatedBy: admin.id,
            updatedAt: new Date()
          }).onConflictDoUpdate({
            target: appSettings.key,
            set: { value: updates, updatedBy: admin.id, updatedAt: new Date() }
          });

          // 6. Broadcast notification to all active students
          const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true));
          if (allUsers.length > 0) {
            await db.insert(notifications).values(allUsers.map((u) => ({
              userId: u.id,
              title: `تحديث عاجل متوفر: ${version}`,
              body: `تنبيه من قناة التليجرام: ${lastMessageText.slice(0, 160)}...`,
              kind: "app_update",
              resourceId: null
            })));
          }

          result = {
            synced: true,
            newVersionRegistered: true,
            version,
            message: `تم تلقائياً اكتشاف إصدار جديد (${version}) في القناة، وتدوينه في النظام، وبث التنبيه لجميع الطلاب بنجاح!`,
            lastPostText: lastMessageText
          };
        }
      }
      auditMetadata = { synced: true };
    } else {
      return Response.json({ error: "إجراء إداري غير معروف" }, { status: 400 });
    }

    await db.insert(auditLogs).values({ actorId: admin.id, action: body.action, entityType: String(body.action).split(".")[0], entityId: body.userId || body.ticketId || null, metadata: auditMetadata });
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
