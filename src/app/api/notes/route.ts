import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const q = new URL(request.url).searchParams.get("q")?.trim();
    const rows = await db.select().from(notes).where(and(eq(notes.userId, user.id), isNull(notes.deletedAt), q ? ilike(notes.title, `%${q}%`) : undefined)).orderBy(desc(notes.updatedAt));
    return Response.json({ notes: rows });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (!body.title?.trim() || !body.body?.trim()) return Response.json({ error: "العنوان والمحتوى مطلوبان" }, { status: 400 });
    const clientUpdatedAt = body.clientUpdatedAt ? new Date(body.clientUpdatedAt) : new Date();
    if (Number.isNaN(clientUpdatedAt.getTime())) return Response.json({ error: "وقت التعديل غير صالح" }, { status: 400 });
    const [note] = await db.insert(notes).values({ id: body.id || undefined, userId: user.id, courseId: body.courseId || null, title: body.title.trim(), body: body.body.trim(), category: body.category?.trim() || null, clientUpdatedAt }).returning();
    return Response.json({ note }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
