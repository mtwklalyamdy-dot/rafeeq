import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, assignments, courseContents, courses, exams, files } from "@/db/schema";
import { errorResponse, requireRole } from "@/lib/auth";
import { requireRepresentativeCourse } from "@/lib/representative";

const contentKinds = new Set(["lecture", "summary", "book", "reference", "exam_model", "text"]);

export async function PUT(request: Request) {
  try {
    const user = await requireRole("representative");
    const body = await request.json();
    const resourceType = String(body.resourceType || "");
    const resourceId = String(body.resourceId || "");
    if (!resourceId) return Response.json({ error: "معرف السجل مطلوب" }, { status: 400 });

    if (resourceType === "course") {
      const course = await db.query.courses.findFirst({ where: eq(courses.id, resourceId) });
      if (!course) return Response.json({ error: "المادة غير موجودة" }, { status: 404 });
      await requireRepresentativeCourse(user.id, course.id);
      const nameAr = String(body.nameAr || course.nameAr).trim();
      if (nameAr.length < 3) return Response.json({ error: "اسم المادة غير صالح" }, { status: 400 });
      const [updated] = await db.update(courses).set({ nameAr, nameEn: String(body.nameEn || "").trim() || null, description: String(body.description || "").trim() || null, creditHours: Math.min(12, Math.max(0, Number(body.creditHours) || 0)), updatedAt: new Date() }).where(eq(courses.id, course.id)).returning();
      return Response.json({ resource: updated, message: "تم تعديل بيانات المادة" });
    }

    if (resourceType === "content") {
      const content = await db.query.courseContents.findFirst({ where: and(eq(courseContents.id, resourceId), eq(courseContents.authorId, user.id)) });
      if (!content) return Response.json({ error: "المحتوى غير موجود أو لا تملكه" }, { status: 404 });
      await requireRepresentativeCourse(user.id, content.courseId);
      if (body.fileId) {
        const file = await db.query.files.findFirst({ where: and(eq(files.id, body.fileId), eq(files.ownerId, user.id)) });
        if (!file) return Response.json({ error: "الملف غير موجود أو لا تملكه" }, { status: 403 });
      }
      const kind = String(body.kind || content.kind);
      if (!contentKinds.has(kind)) return Response.json({ error: "نوع المحتوى غير صالح" }, { status: 400 });
      const [updated] = await db.update(courseContents).set({ title: String(body.title || content.title).trim(), description: String(body.description || "").trim() || null, body: String(body.body || "").trim() || null, kind: kind as typeof content.kind, fileId: body.fileId ? String(body.fileId) : content.fileId, allowDownload: body.allowDownload !== false, version: content.version + 1, updatedAt: new Date() }).where(eq(courseContents.id, content.id)).returning();
      return Response.json({ resource: updated, message: "تم تعديل المحتوى وإصدار نسخة جديدة" });
    }

    if (resourceType === "assignment") {
      const assignment = await db.query.assignments.findFirst({ where: and(eq(assignments.id, resourceId), eq(assignments.authorId, user.id)) });
      if (!assignment) return Response.json({ error: "الواجب غير موجود أو لا تملكه" }, { status: 404 });
      await requireRepresentativeCourse(user.id, assignment.courseId);
      const dueAt = body.dueAt ? new Date(String(body.dueAt)) : assignment.dueAt;
      if (Number.isNaN(dueAt.getTime())) return Response.json({ error: "الموعد النهائي غير صالح" }, { status: 400 });
      const [updated] = await db.update(assignments).set({ title: String(body.title || assignment.title).trim(), description: String(body.description || assignment.description).trim(), dueAt, maxScore: String(Math.max(1, Number(body.maxScore) || Number(assignment.maxScore))), updatedAt: new Date() }).where(eq(assignments.id, assignment.id)).returning();
      return Response.json({ resource: updated, message: "تم تعديل الواجب" });
    }

    if (resourceType === "exam") {
      const exam = await db.query.exams.findFirst({ where: eq(exams.id, resourceId) });
      if (!exam) return Response.json({ error: "الاختبار غير موجود" }, { status: 404 });
      await requireRepresentativeCourse(user.id, exam.courseId);
      const startsAt = body.startsAt ? new Date(String(body.startsAt)) : exam.startsAt;
      const endsAt = body.endsAt ? new Date(String(body.endsAt)) : exam.endsAt;
      if (startsAt && Number.isNaN(startsAt.getTime()) || endsAt && Number.isNaN(endsAt.getTime())) return Response.json({ error: "موعد الاختبار غير صالح" }, { status: 400 });
      const [updated] = await db.update(exams).set({ title: String(body.title || exam.title).trim(), instructions: String(body.instructions || "").trim() || null, durationMinutes: Math.min(300, Math.max(1, Number(body.durationMinutes) || exam.durationMinutes)), startsAt, endsAt, showCorrectAnswers: body.showCorrectAnswers === true, updatedAt: new Date() }).where(eq(exams.id, exam.id)).returning();
      return Response.json({ resource: updated, message: "تم تعديل إعدادات الاختبار؛ الأسئلة الحالية محفوظة" });
    }

    if (resourceType === "announcement") {
      const announcement = await db.query.announcements.findFirst({ where: and(eq(announcements.id, resourceId), eq(announcements.authorId, user.id)) });
      if (!announcement) return Response.json({ error: "الإعلان غير موجود أو لا تملكه" }, { status: 404 });
      const [updated] = await db.update(announcements).set({ title: String(body.title || announcement.title).trim(), body: String(body.body || announcement.body).trim(), updatedAt: new Date() }).where(eq(announcements.id, announcement.id)).returning();
      return Response.json({ resource: updated, message: "تم تعديل الإعلان" });
    }

    return Response.json({ error: "نوع التعديل غير مدعوم" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
