import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  assignmentAttachments,
  assignments,
  calendarEvents,
  courseContents,
  courses,
  exams,
  files,
  questions,
  representativeAssignments,
  representativePublications,
} from "@/db/schema";
import { errorResponse, requireRole } from "@/lib/auth";
import { notifyAcademicTarget, requireRepresentativeCourse } from "@/lib/representative";

const contentKinds = new Set(["lecture", "summary", "book", "reference", "exam_model", "text"]);
const questionTypes = new Set(["multiple_choice", "true_false", "text", "numeric"]);

export async function POST(request: Request) {
  try {
    const user = await requireRole("representative");
    const body = await request.json();

    if (body.type === "course") {
      const nameAr = String(body.nameAr || "").trim();
      const code = String(body.code || "").trim().toUpperCase();
      if (nameAr.length < 3 || !/^[A-Z0-9_-]{2,40}$/.test(code)) return Response.json({ error: "أدخل اسم مادة ورمزًا إنجليزيًا صالحًا" }, { status: 400 });
      const existing = await db.query.courses.findFirst({ where: eq(courses.code, code) });
      if (existing) return Response.json({ error: "رمز المادة مستخدم بالفعل" }, { status: 409 });
      const [course] = await db.transaction(async (tx) => {
        const created = await tx.insert(courses).values({
          departmentId: user.departmentId,
          levelId: user.levelId,
          semesterId: user.semesterId,
          nameAr,
          nameEn: body.nameEn?.trim() || null,
          code,
          creditHours: Math.min(12, Math.max(0, Number(body.creditHours) || 0)),
          description: body.description?.trim() || null,
        }).returning();
        await tx.insert(representativeAssignments).values({ representativeId: user.id, courseId: created[0].id, canPublishDirectly: true });
        return created;
      });
      return Response.json({ publication: course, message: "تم إنشاء المادة وإسنادها إلى حسابك" }, { status: 201 });
    }

    const courseId = String(body.courseId || "");
    if (!courseId) return Response.json({ error: "اختر المادة" }, { status: 400 });
    const permission = await requireRepresentativeCourse(user.id, courseId);
    const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
    if (!course) return Response.json({ error: "المادة غير موجودة" }, { status: 404 });

    if (body.fileId) {
      const file = await db.query.files.findFirst({ where: and(eq(files.id, body.fileId), eq(files.ownerId, user.id)) });
      if (!file) return Response.json({ error: "الملف غير موجود أو لا تملكه" }, { status: 403 });
      if (["assignment", "book", "reference", "exam_model"].includes(body.type === "content" ? body.kind : body.type) && file.mimeType !== "application/pdf") {
        return Response.json({ error: "هذا النوع يتطلب ملف PDF حقيقيًا" }, { status: 400 });
      }
    }

    if (body.type === "assignment") return createAssignment(user, course, permission.canPublishDirectly, body);
    if (body.type === "exam") return createExam(user, course, permission.canPublishDirectly, body);
    if (body.type === "announcement") return createAnnouncement(user, course, body);
    if (body.type === "reminder") return createLectureReminder(user, course, body);
    return createContent(user, course, permission.canPublishDirectly, body);
  } catch (error) {
    return errorResponse(error);
  }
}

async function createContent(user: Awaited<ReturnType<typeof requireRole>>, course: typeof courses.$inferSelect, publishDirectly: boolean, body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const kind = String(body.kind || "");
  if (title.length < 3) return Response.json({ error: "عنوان المحتوى مطلوب" }, { status: 400 });
  if (!contentKinds.has(kind)) return Response.json({ error: "نوع المحتوى غير صالح" }, { status: 400 });
  if (!body.fileId && !String(body.body || "").trim()) return Response.json({ error: "أرفق ملفًا أو أضف نص المحتوى" }, { status: 400 });
  const [content] = await db.insert(courseContents).values({
    courseId: course.id,
    authorId: user.id,
    fileId: body.fileId ? String(body.fileId) : null,
    title,
    description: String(body.description || "").trim() || null,
    body: String(body.body || "").trim() || null,
    kind: kind as "lecture" | "summary" | "book" | "reference" | "exam_model" | "text",
    status: publishDirectly ? "published" : "pending",
    publishedAt: publishDirectly ? new Date() : null,
    allowDownload: body.allowDownload !== false,
    sourceLabel: "نشر المندوب الطلابي",
  }).returning();
  await db.insert(representativePublications).values({ representativeId: user.id, contentId: content.id });
  let notified = 0;
  if (publishDirectly) notified = await notifyAcademicTarget({ levelId: course.levelId || user.levelId, groupName: user.groupName, title: `محتوى جديد: ${title}`, body: `نشر المندوب محتوى جديدًا في مادة ${course.nameAr}.`, kind: "representative_content", resourceId: content.id, excludeUserId: user.id });
  return Response.json({ publication: content, notified, message: publishDirectly ? "نُشر المحتوى وأُرسل إشعار للطلاب المستهدفين" : "أُرسل المحتوى للمراجعة" }, { status: 201 });
}

async function createAssignment(user: Awaited<ReturnType<typeof requireRole>>, course: typeof courses.$inferSelect, publishDirectly: boolean, body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const dueAt = new Date(String(body.dueAt || ""));
  if (title.length < 3 || description.length < 5) return Response.json({ error: "عنوان الواجب وتعليماته مطلوبان" }, { status: 400 });
  if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) return Response.json({ error: "حدد موعدًا نهائيًا مستقبليًا" }, { status: 400 });
  const [assignment] = await db.transaction(async (tx) => {
    const created = await tx.insert(assignments).values({ courseId: course.id, authorId: user.id, title, description, targetLevelId: course.levelId || user.levelId, targetGroup: String(body.targetGroup || "").trim() || user.groupName || null, dueAt, maxScore: String(Math.max(1, Number(body.maxScore) || 100)), status: publishDirectly ? "published" : "pending", publishedAt: publishDirectly ? new Date() : null }).returning();
    if (body.fileId) await tx.insert(assignmentAttachments).values({ assignmentId: created[0].id, fileId: String(body.fileId) });
    await tx.insert(representativePublications).values({ representativeId: user.id, assignmentId: created[0].id });
    return created;
  });
  let notified = 0;
  if (publishDirectly) notified = await notifyAcademicTarget({ levelId: course.levelId || user.levelId, groupName: assignment.targetGroup, title: `واجب جديد: ${title}`, body: `أضيف واجب في ${course.nameAr}. الموعد النهائي ${dueAt.toLocaleString("ar-YE")}.`, kind: "assignment_new", resourceId: assignment.id, excludeUserId: user.id });
  return Response.json({ publication: assignment, notified, message: publishDirectly ? "نُشر الواجب وأُرسل إشعار" : "أُرسل الواجب للمراجعة" }, { status: 201 });
}

async function createExam(user: Awaited<ReturnType<typeof requireRole>>, course: typeof courses.$inferSelect, publishDirectly: boolean, body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const durationMinutes = Math.min(300, Math.max(1, Number(body.durationMinutes) || 0));
  const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null;
  const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
  const items = Array.isArray(body.questions) ? body.questions : [];
  if (title.length < 3 || !durationMinutes) return Response.json({ error: "عنوان الاختبار ومدته مطلوبان" }, { status: 400 });
  if (!items.length || items.length > 100) return Response.json({ error: "أضف سؤالًا واحدًا على الأقل وبحد أقصى 100 سؤال" }, { status: 400 });
  if (startsAt && Number.isNaN(startsAt.getTime())) return Response.json({ error: "وقت بداية الاختبار غير صالح" }, { status: 400 });
  if (endsAt && (Number.isNaN(endsAt.getTime()) || (startsAt && endsAt <= startsAt))) return Response.json({ error: "وقت نهاية الاختبار غير صالح" }, { status: 400 });
  const normalized = items.map((raw: Record<string, unknown>, index: number) => normalizeQuestion(raw, index));
  const invalid = normalized.find((item) => "error" in item);
  if (invalid && "error" in invalid) return Response.json({ error: invalid.error }, { status: 400 });
  const [exam] = await db.transaction(async (tx) => {
    const created = await tx.insert(exams).values({ courseId: course.id, title, instructions: String(body.instructions || "").trim() || null, durationMinutes, startsAt, endsAt, isPublished: publishDirectly, showCorrectAnswers: body.showCorrectAnswers === true || body.showCorrectAnswers === "on" }).returning();
    await tx.insert(questions).values(normalized.map((item) => ({ ...item, examId: created[0].id })) as Array<typeof questions.$inferInsert>);
    return created;
  });
  let notified = 0;
  if (publishDirectly) notified = await notifyAcademicTarget({ levelId: course.levelId || user.levelId, groupName: user.groupName, title: `اختبار جديد: ${title}`, body: `نُشر اختبار في مادة ${course.nameAr}${startsAt ? ` ويبدأ ${startsAt.toLocaleString("ar-YE")}` : ""}.`, kind: "exam_new", resourceId: exam.id, excludeUserId: user.id });
  return Response.json({ publication: exam, notified, message: publishDirectly ? "نُشر الاختبار وأُرسل إشعار" : "حُفظ الاختبار كمسودة حتى تسمح الإدارة بالنشر المباشر" }, { status: 201 });
}

function normalizeQuestion(raw: Record<string, unknown>, index: number) {
  const type = String(raw.type || "");
  const prompt = String(raw.prompt || "").trim();
  const points = Math.max(0.25, Number(raw.points) || 1);
  if (!questionTypes.has(type) || prompt.length < 2) return { error: `بيانات السؤال ${index + 1} غير صالحة` };
  let options: string[] | null = null;
  let correctAnswer: unknown = raw.correctAnswer;
  if (type === "multiple_choice") {
    options = Array.isArray(raw.options) ? raw.options.map(String).map((value) => value.trim()).filter(Boolean) : [];
    if (options.length < 2 || !options.includes(String(correctAnswer))) return { error: `خيارات أو إجابة السؤال ${index + 1} غير صالحة` };
  } else if (type === "true_false") {
    options = ["صح", "خطأ"];
    correctAnswer = String(correctAnswer) === "خطأ" ? "خطأ" : "صح";
  } else if (type === "numeric") {
    if (!Number.isFinite(Number(correctAnswer))) return { error: `الإجابة الرقمية للسؤال ${index + 1} غير صالحة` };
    correctAnswer = Number(correctAnswer);
  } else correctAnswer = String(correctAnswer || "").trim();
  return { type: type as "multiple_choice" | "true_false" | "text" | "numeric", prompt, options, correctAnswer, points: String(points), sortOrder: index + 1 };
}

async function createAnnouncement(user: Awaited<ReturnType<typeof requireRole>>, course: typeof courses.$inferSelect, body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const text = String(body.description || body.body || "").trim();
  if (title.length < 3 || text.length < 5) return Response.json({ error: "عنوان الإعلان ومحتواه مطلوبان" }, { status: 400 });
  const [announcement] = await db.insert(announcements).values({ authorId: user.id, title, body: text, targetLevelId: course.levelId || user.levelId, targetGroup: String(body.targetGroup || "").trim() || user.groupName || null, isPublished: true, publishedAt: new Date() }).returning();
  const notified = await notifyAcademicTarget({ levelId: announcement.targetLevelId, groupName: announcement.targetGroup, title, body: text, kind: "representative_announcement", resourceId: announcement.id, excludeUserId: user.id });
  return Response.json({ publication: announcement, notified, message: "نُشر الإعلان وأُرسل للطلاب المستهدفين" }, { status: 201 });
}

async function createLectureReminder(user: Awaited<ReturnType<typeof requireRole>>, course: typeof courses.$inferSelect, body: Record<string, unknown>) {
  const startsAt = new Date(String(body.startsAt || ""));
  const title = String(body.title || `محاضرة ${course.nameAr}`).trim();
  const room = String(body.room || "").trim();
  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) return Response.json({ error: "حدد موعد محاضرة مستقبليًا" }, { status: 400 });
  const description = `${String(body.description || "تذكير بموعد المحاضرة").trim()}${room ? ` — القاعة: ${room}` : ""}`;
  const event = await db.transaction(async (tx) => {
    const [created] = await tx.insert(calendarEvents).values({ ownerId: user.id, title, description, kind: "lecture", startsAt, isOfficial: true }).returning();
    await tx.insert(announcements).values({ authorId: user.id, title: `تذكير: ${title}`, body: `${description}. الموعد: ${startsAt.toLocaleString("ar-YE")}`, targetLevelId: course.levelId || user.levelId, targetGroup: user.groupName || null, isPublished: true, publishedAt: new Date() });
    return created;
  });
  const notified = await notifyAcademicTarget({ levelId: course.levelId || user.levelId, groupName: user.groupName, title: `محاضرة قادمة: ${course.nameAr}`, body: `${description}. الموعد: ${startsAt.toLocaleString("ar-YE")}`, kind: "lecture_reminder", resourceId: event.id, excludeUserId: user.id });
  return Response.json({ publication: event, notified, message: "تم نشر موعد المحاضرة وإرسال التنبيه" }, { status: 201 });
}
