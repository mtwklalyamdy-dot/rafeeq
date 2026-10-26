import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, assignments, courseContents, courses, exams, representativeAssignments } from "@/db/schema";
import { errorResponse, requireRole } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireRole("representative");
    const assignedCourses = await db.select({
      id: courses.id,
      name: courses.nameAr,
      nameEn: courses.nameEn,
      code: courses.code,
      description: courses.description,
      creditHours: courses.creditHours,
      levelId: courses.levelId,
      canPublishDirectly: representativeAssignments.canPublishDirectly,
    }).from(representativeAssignments)
      .innerJoin(courses, eq(representativeAssignments.courseId, courses.id))
      .where(eq(representativeAssignments.representativeId, user.id));

    const contents = await db.select({ id: courseContents.id, courseId: courseContents.courseId, title: courseContents.title, description: courseContents.description, body: courseContents.body, kind: courseContents.kind, status: courseContents.status, version: courseContents.version, updatedAt: courseContents.updatedAt, courseName: courses.nameAr })
      .from(courseContents).innerJoin(courses, eq(courseContents.courseId, courses.id)).where(eq(courseContents.authorId, user.id)).orderBy(desc(courseContents.updatedAt));
    const assignmentRows = await db.select({ id: assignments.id, courseId: assignments.courseId, title: assignments.title, description: assignments.description, status: assignments.status, dueAt: assignments.dueAt, maxScore: assignments.maxScore, updatedAt: assignments.updatedAt, courseName: courses.nameAr })
      .from(assignments).innerJoin(courses, eq(assignments.courseId, courses.id)).where(eq(assignments.authorId, user.id)).orderBy(desc(assignments.updatedAt));
    const examRows = await db.select({ id: exams.id, courseId: exams.courseId, title: exams.title, instructions: exams.instructions, durationMinutes: exams.durationMinutes, startsAt: exams.startsAt, endsAt: exams.endsAt, isPublished: exams.isPublished, updatedAt: exams.updatedAt, courseName: courses.nameAr })
      .from(exams).innerJoin(courses, eq(exams.courseId, courses.id)).innerJoin(representativeAssignments, eq(representativeAssignments.courseId, exams.courseId)).where(eq(representativeAssignments.representativeId, user.id)).orderBy(desc(exams.updatedAt));
    const announcementRows = await db.select({ id: announcements.id, title: announcements.title, body: announcements.body, isPublished: announcements.isPublished, updatedAt: announcements.updatedAt })
      .from(announcements).where(eq(announcements.authorId, user.id)).orderBy(desc(announcements.updatedAt));

    return Response.json({ user, courses: assignedCourses, contents, assignments: assignmentRows, exams: examRows, announcements: announcementRows });
  } catch (error) {
    return errorResponse(error);
  }
}
