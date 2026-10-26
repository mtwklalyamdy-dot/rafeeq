import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { courseContents, courses, files, profiles, users } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    const params = new URL(request.url).searchParams;
    const search = params.get("q")?.trim();
    const courseId = params.get("courseId");
    const kind = params.get("kind");
    const rows = await db.select({ id: courseContents.id, title: courseContents.title, description: courseContents.description, body: courseContents.body, kind: courseContents.kind, sourceLabel: courseContents.sourceLabel, allowDownload: courseContents.allowDownload, version: courseContents.version, publishedAt: courseContents.publishedAt, courseId: courses.id, courseName: courses.nameAr, authorName: users.fullName, fileId: files.id, fileName: files.originalName, fileSize: files.sizeBytes, mimeType: files.mimeType })
      .from(courseContents).innerJoin(courses, eq(courseContents.courseId, courses.id)).leftJoin(users, eq(courseContents.authorId, users.id)).leftJoin(files, eq(courseContents.fileId, files.id))
      .where(and(
        eq(courseContents.status, "published"),
        profile?.departmentId ? eq(courses.departmentId, profile.departmentId) : undefined,
        profile?.levelId ? eq(courses.levelId, profile.levelId) : undefined,
        courseId ? eq(courses.id, courseId) : undefined,
        kind && ["lecture","summary","book","reference","exam_model","text"].includes(kind) ? eq(courseContents.kind, kind as typeof courseContents.kind.enumValues[number]) : undefined,
        search ? ilike(courseContents.title, `%${search}%`) : undefined
      ))
      .orderBy(desc(courseContents.publishedAt)).limit(100);
    return Response.json({ content: rows });
  } catch (error) { return errorResponse(error); }
}
