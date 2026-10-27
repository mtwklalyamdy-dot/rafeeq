import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assignmentAttachments, assignments, courseContents, files } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";
import { loadPrivateFile } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const file = await db.query.files.findFirst({ where: eq(files.id, id) });
    if (!file) return Response.json({ error: "الملف غير موجود" }, { status: 404 });
    let allowed = file.ownerId === user.id || file.isPublic || user.role === "admin" || user.role === "support";
    if (!allowed) {
      const publishedContent = await db.query.courseContents.findFirst({ where: and(eq(courseContents.fileId, id), eq(courseContents.status, "published")) });
      const assignmentFile = await db.select({ id: assignments.id }).from(assignmentAttachments).innerJoin(assignments, eq(assignmentAttachments.assignmentId, assignments.id)).where(and(eq(assignmentAttachments.fileId, id), eq(assignments.status, "published"))).limit(1);
      allowed = Boolean(publishedContent || assignmentFile[0]);
    }
    if (!allowed) return Response.json({ error: "لا تملك صلاحية الوصول إلى الملف" }, { status: 403 });
    const data = await loadPrivateFile(file.storageKey);
    return new Response(data, { headers: { "Content-Type": file.mimeType, "Content-Length": String(file.sizeBytes), "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
