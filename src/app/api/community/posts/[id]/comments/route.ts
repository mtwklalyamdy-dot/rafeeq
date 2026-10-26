import { eq } from "drizzle-orm";
import { db } from "@/db";
import { communityComments, communityPosts, notifications } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rate = await checkRateLimit("community-comment", 20, 10 * 60 * 1000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  try {
    const user = await requireUser(); const { id } = await context.params; const body = await request.json();
    if (!body.body?.trim() || body.body.trim().length < 2) return Response.json({ error: "اكتب ردًا واضحًا" }, { status: 400 });
    const post = await db.query.communityPosts.findFirst({ where: eq(communityPosts.id, id) });
    if (!post || post.status === "hidden") return Response.json({ error: "المنشور غير موجود" }, { status: 404 });
    const [comment] = await db.insert(communityComments).values({ postId: id, authorId: user.id, body: body.body.trim(), isAiGenerated: false }).returning();
    await db.update(communityPosts).set({ status: "answered", updatedAt: new Date() }).where(eq(communityPosts.id, id));
    if (post.authorId !== user.id) await db.insert(notifications).values({ userId: post.authorId, title: "رد جديد في مجتمع رفيقي", body: `تمت إضافة رد على: ${post.title}`, kind: "community_reply", resourceId: post.id });
    return Response.json({ comment }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
