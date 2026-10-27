import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { communityComments, communityPosts, communityReactions, communityReports, communitySaves } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params; const body = await request.json();
    const post = await db.query.communityPosts.findFirst({ where: eq(communityPosts.id, id) });
    if (!post) return Response.json({ error: "المنشور غير موجود" }, { status: 404 });
    if (body.action === "save") {
      await db.insert(communitySaves).values({ userId: user.id, postId: id }).onConflictDoNothing();
    } else if (body.action === "like") {
      const comment = await db.query.communityComments.findFirst({ where: and(eq(communityComments.id, body.commentId), eq(communityComments.postId, id)) });
      if (!comment) return Response.json({ error: "الرد غير موجود" }, { status: 404 });
      await db.insert(communityReactions).values({ userId: user.id, commentId: comment.id }).onConflictDoNothing();
    } else if (body.action === "report") {
      if (!body.reason?.trim()) return Response.json({ error: "سبب البلاغ مطلوب" }, { status: 400 });
      await db.insert(communityReports).values({ reporterId: user.id, postId: id, commentId: body.commentId || null, reason: body.reason.trim() });
    } else if (body.action === "solve") {
      if (post.authorId !== user.id) return Response.json({ error: "صاحب السؤال فقط يستطيع تحديد الحل" }, { status: 403 });
      const comment = await db.query.communityComments.findFirst({ where: and(eq(communityComments.id, body.commentId), eq(communityComments.postId, id)) });
      if (!comment) return Response.json({ error: "الرد غير موجود" }, { status: 404 });
      await db.update(communityPosts).set({ status: "solved", solvedCommentId: comment.id, updatedAt: new Date() }).where(eq(communityPosts.id, id));
    } else return Response.json({ error: "الإجراء غير صالح" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
