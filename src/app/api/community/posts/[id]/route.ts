import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { communityCategories, communityComments, communityPosts, users } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    const post = await db.select({ id: communityPosts.id, title: communityPosts.title, body: communityPosts.body, status: communityPosts.status, authorId: users.id, authorName: users.fullName, categoryName: communityCategories.nameAr, createdAt: communityPosts.createdAt })
      .from(communityPosts).innerJoin(users, eq(communityPosts.authorId, users.id)).innerJoin(communityCategories, eq(communityPosts.categoryId, communityCategories.id)).where(eq(communityPosts.id, id)).limit(1);
    if (!post[0] || post[0].status === "hidden") return Response.json({ error: "المنشور غير موجود" }, { status: 404 });
    const comments = await db.select({ id: communityComments.id, body: communityComments.body, isAiGenerated: communityComments.isAiGenerated, createdAt: communityComments.createdAt, authorId: users.id, authorName: users.fullName })
      .from(communityComments).innerJoin(users, eq(communityComments.authorId, users.id)).where(and(eq(communityComments.postId, id), eq(communityComments.isHidden, false))).orderBy(asc(communityComments.createdAt));
    return Response.json({ post: post[0], comments });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params; const body = await request.json();
    const existing = await db.query.communityPosts.findFirst({ where: eq(communityPosts.id, id) });
    if (!existing) return Response.json({ error: "المنشور غير موجود" }, { status: 404 });
    if (existing.authorId !== user.id && user.role !== "admin") return Response.json({ error: "لا يمكنك تعديل منشور مستخدم آخر" }, { status: 403 });
    const [post] = await db.update(communityPosts).set({ title: body.title?.trim() || existing.title, body: body.body?.trim() || existing.body, updatedAt: new Date() }).where(eq(communityPosts.id, id)).returning();
    return Response.json({ post });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params;
    const existing = await db.query.communityPosts.findFirst({ where: eq(communityPosts.id, id) });
    if (!existing) return Response.json({ error: "المنشور غير موجود" }, { status: 404 });
    if (existing.authorId !== user.id && user.role !== "admin") return Response.json({ error: "لا يمكنك حذف منشور مستخدم آخر" }, { status: 403 });
    await db.update(communityPosts).set({ status: "hidden", updatedAt: new Date() }).where(eq(communityPosts.id, id));
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
