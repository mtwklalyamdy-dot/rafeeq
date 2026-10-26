import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { examAnswers, examAttempts, exams, questions } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params;
    const exam = await db.query.exams.findFirst({ where: and(eq(exams.id, id), eq(exams.isPublished, true)) });
    if (!exam) return Response.json({ error: "الاختبار غير متاح" }, { status: 404 });
    const now = new Date();
    if (exam.startsAt && exam.startsAt > now) return Response.json({ error: "لم يبدأ الاختبار بعد" }, { status: 403 });
    if (exam.endsAt && exam.endsAt < now) return Response.json({ error: "انتهى الاختبار" }, { status: 403 });
    let attempt = await db.query.examAttempts.findFirst({ where: and(eq(examAttempts.examId, id), eq(examAttempts.studentId, user.id)) });
    if (attempt?.isFinal) return Response.json({ error: "تم تسليم هذا الاختبار مسبقًا" }, { status: 409 });
    if (!attempt) [attempt] = await db.insert(examAttempts).values({ examId: id, studentId: user.id }).returning();
    const items = await db.select({ id: questions.id, type: questions.type, prompt: questions.prompt, options: questions.options, points: questions.points, sortOrder: questions.sortOrder }).from(questions).where(eq(questions.examId, id)).orderBy(asc(questions.sortOrder));
    return Response.json({ exam: { ...exam, correctAnswers: undefined }, attempt, questions: items, expiresAt: new Date(Math.min(exam.endsAt?.getTime() || Infinity, attempt.startedAt.getTime() + exam.durationMinutes * 60_000)).toISOString() });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params; const body = await request.json();
    const exam = await db.query.exams.findFirst({ where: and(eq(exams.id, id), eq(exams.isPublished, true)) });
    const attempt = await db.query.examAttempts.findFirst({ where: and(eq(examAttempts.examId, id), eq(examAttempts.studentId, user.id)) });
    if (!exam || !attempt || attempt.isFinal) return Response.json({ error: "محاولة الاختبار غير صالحة" }, { status: 409 });
    const deadline = Math.min(exam.endsAt?.getTime() || Infinity, attempt.startedAt.getTime() + exam.durationMinutes * 60_000);
    if (Date.now() > deadline + 30_000) return Response.json({ error: "انتهى وقت الاختبار" }, { status: 409 });
    const items = await db.select().from(questions).where(eq(questions.examId, id));
    const submitted = typeof body.answers === "object" && body.answers ? body.answers as Record<string, unknown> : {};
    let score = 0; let needsManualReview = false;
    await db.transaction(async (tx) => {
      for (const question of items) {
        const answer = submitted[question.id] ?? null;
        let awarded: string | null = null;
        if (question.type === "text") needsManualReview = true;
        else {
          const correct = normalise(question.correctAnswer);
          const actual = normalise(answer);
          const matches = question.type === "numeric" ? Number(correct) === Number(actual) : correct === actual;
          awarded = matches ? question.points : "0";
          if (matches) score += Number(question.points);
        }
        await tx.insert(examAnswers).values({ attemptId: attempt.id, questionId: question.id, answer, awardedPoints: awarded }).onConflictDoUpdate({ target: [examAnswers.attemptId, examAnswers.questionId], set: { answer, awardedPoints: awarded, updatedAt: new Date() } });
      }
      await tx.update(examAttempts).set({ isFinal: true, submittedAt: new Date(), score: String(score) }).where(eq(examAttempts.id, attempt.id));
    });
    return Response.json({ ok: true, score: needsManualReview ? null : score, needsManualReview, showCorrectAnswers: exam.showCorrectAnswers });
  } catch (error) { return errorResponse(error); }
}

function normalise(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  return JSON.stringify(value);
}
