import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { assignmentAttachments, assignments, assignmentSubmissions, courses, files, profiles } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    const rows = await db.select({ id: assignments.id, title: assignments.title, description: assignments.description, courseName: courses.nameAr, courseId: courses.id, dueAt: assignments.dueAt, maxScore: assignments.maxScore, publishedAt: assignments.publishedAt, submissionId: assignmentSubmissions.id, submissionStatus: assignmentSubmissions.status, submittedAt: assignmentSubmissions.submittedAt, score: assignmentSubmissions.score })
      .from(assignments).innerJoin(courses, eq(assignments.courseId, courses.id)).leftJoin(assignmentSubmissions, and(eq(assignmentSubmissions.assignmentId, assignments.id), eq(assignmentSubmissions.studentId, user.id)))
      .where(and(
        eq(assignments.status, "published"),
        profile?.departmentId ? eq(courses.departmentId, profile.departmentId) : undefined,
        profile?.levelId ? eq(courses.levelId, profile.levelId) : undefined,
        profile?.groupName ? or(eq(assignments.targetGroup, profile.groupName), isNull(assignments.targetGroup)) : isNull(assignments.targetGroup)
      )).orderBy(asc(assignments.dueAt));
    const attachments = rows.length ? await db.select({ assignmentId: assignmentAttachments.assignmentId, fileId: files.id, name: files.originalName, size: files.sizeBytes }).from(assignmentAttachments).innerJoin(files, eq(assignmentAttachments.fileId, files.id)).orderBy(desc(files.createdAt)) : [];
    return Response.json({ assignments: rows.map((row) => ({ ...row, attachments: attachments.filter((file) => file.assignmentId === row.id) })) });
  } catch (error) { return errorResponse(error); }
}
