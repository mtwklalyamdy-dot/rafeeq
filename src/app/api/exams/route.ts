import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { courses, exams, profiles } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    const rows = await db.select({ id: exams.id, title: exams.title, instructions: exams.instructions, durationMinutes: exams.durationMinutes, startsAt: exams.startsAt, endsAt: exams.endsAt, courseName: courses.nameAr })
      .from(exams).innerJoin(courses, eq(exams.courseId, courses.id))
      .where(and(
        eq(exams.isPublished, true),
        profile?.departmentId ? eq(courses.departmentId, profile.departmentId) : undefined,
        profile?.levelId ? eq(courses.levelId, profile.levelId) : undefined
      )).orderBy(asc(exams.startsAt));
    return Response.json({ exams: rows });
  } catch (error) { return errorResponse(error); }
}
