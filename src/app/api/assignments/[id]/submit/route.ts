import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assignments, assignmentSubmissions, files } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "student") return Response.json({ error: "التسليم متاح لحساب الطالب فقط" }, { status: 403 });
    const { id } = await context.params;
    const assignment = await db.query.assignments.findFirst({ where: and(eq(assignments.id, id), eq(assignments.status, "published")) });
    if (!assignment) return Response.json({ error: "التكليف غير موجود" }, { status: 404 });
    if (assignment.dueAt < new Date()) return Response.json({ error: "انتهى موعد التسليم" }, { status: 409 });
    const body = await request.json();
    if (!body.answerText?.trim() && !body.fileId) return Response.json({ error: "أدخل الحل أو ارفع ملف الإجابة" }, { status: 400 });
    if (body.fileId) {
      const owned = await db.query.files.findFirst({ where: and(eq(files.id, body.fileId), eq(files.ownerId, user.id)) });
      if (!owned) return Response.json({ error: "ملف الإجابة غير صالح" }, { status: 403 });
    }
    const existing = await db.query.assignmentSubmissions.findFirst({ where: and(eq(assignmentSubmissions.assignmentId, id), eq(assignmentSubmissions.studentId, user.id)) });
    if (existing?.status === "graded") return Response.json({ error: "لا يمكن تعديل تسليم تم تقييمه" }, { status: 409 });
    const [submission] = existing
      ? await db.update(assignmentSubmissions).set({ answerText: body.answerText?.trim() || null, answerFileId: body.fileId || null, status: "submitted", submittedAt: new Date(), updatedAt: new Date() }).where(eq(assignmentSubmissions.id, existing.id)).returning()
      : await db.insert(assignmentSubmissions).values({ assignmentId: id, studentId: user.id, answerText: body.answerText?.trim() || null, answerFileId: body.fileId || null, status: "submitted", submittedAt: new Date() }).returning();
    return Response.json({ submission });
  } catch (error) { return errorResponse(error); }
}
