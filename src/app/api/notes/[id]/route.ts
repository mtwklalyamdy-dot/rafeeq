import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const existing = await db.query.notes.findFirst({ where: and(eq(notes.id, id), eq(notes.userId, user.id)) });
    if (!existing || existing.deletedAt) return Response.json({ error: "الملاحظة غير موجودة" }, { status: 404 });
    if (Number(body.version) !== existing.version) return Response.json({ error: "توجد نسخة أحدث على الخادم", conflict: existing }, { status: 409 });
    const [note] = await db.update(notes).set({ title: body.title?.trim() || existing.title, body: body.body?.trim() || existing.body, category: body.category?.trim() || null, courseId: body.courseId || null, clientUpdatedAt: body.clientUpdatedAt ? new Date(body.clientUpdatedAt) : new Date(), version: existing.version + 1, updatedAt: new Date() }).where(and(eq(notes.id, id), eq(notes.userId, user.id), eq(notes.version, existing.version))).returning();
    return Response.json({ note });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const [note] = await db.update(notes).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(notes.id, id), eq(notes.userId, user.id))).returning();
    if (!note) return Response.json({ error: "الملاحظة غير موجودة" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
