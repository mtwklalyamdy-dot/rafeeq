import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { communityCategories, communityPosts, users } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

import { communitySaves } from "@/db/schema";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim();
    const categoryId = params.get("categoryId");
    const status = params.get("status");
    const isSavedOnly = params.get("saved") === "true";

    let queryBuilder = db.select({ 
      id: communityPosts.id, 
      title: communityPosts.title, 
      body: communityPosts.body, 
      status: communityPosts.status, 
      isAiGenerated: communityPosts.isAiGenerated, 
      createdAt: communityPosts.createdAt, 
      updatedAt: communityPosts.updatedAt, 
      authorId: users.id, 
      authorName: users.fullName, 
      categoryId: communityCategories.id, 
      categoryName: communityCategories.nameAr 
    })
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.authorId, users.id))
      .innerJoin(communityCategories, eq(communityPosts.categoryId, communityCategories.id));

    if (isSavedOnly) {
      queryBuilder = queryBuilder.innerJoin(communitySaves, and(eq(communitySaves.postId, communityPosts.id), eq(communitySaves.userId, user.id))) as any;
    }

    const posts = await queryBuilder
      .where(and(
        eq(communityCategories.isActive, true), 
        categoryId ? eq(communityPosts.categoryId, categoryId) : undefined, 
        status && ["new","waiting","answered","solved"].includes(status) ? eq(communityPosts.status, status as "new" | "waiting" | "answered" | "solved") : undefined, 
        q ? ilike(communityPosts.title, `%${q}%`) : undefined
      ))
      .orderBy(desc(communityPosts.createdAt))
      .limit(100);

    const categories = await db.select().from(communityCategories).where(eq(communityCategories.isActive, true));
    return Response.json({ posts, categories });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const rate = await checkRateLimit("community-post", 8, 10 * 60 * 1000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  try {
    const user = await requireUser();
    const body = await request.json();
    if (!body.title?.trim() || body.title.trim().length < 5 || !body.body?.trim() || body.body.trim().length < 10) return Response.json({ error: "اكتب عنوانًا ومحتوى واضحين" }, { status: 400 });
    const category = await db.query.communityCategories.findFirst({ where: and(eq(communityCategories.id, body.categoryId), eq(communityCategories.isActive, true)) });
    if (!category) return Response.json({ error: "القسم غير صالح" }, { status: 400 });
    const [post] = await db.insert(communityPosts).values({ authorId: user.id, categoryId: category.id, courseId: body.courseId || null, levelId: body.levelId || null, title: body.title.trim(), body: body.body.trim(), status: "waiting", isAiGenerated: false }).returning();
    return Response.json({ post }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
