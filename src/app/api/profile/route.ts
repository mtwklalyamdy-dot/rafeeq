import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions, users } from "@/db/schema";
import { destroySession, errorResponse, requireUser } from "@/lib/auth";

export async function GET() {
  try { return Response.json({ user: await requireUser() }); } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(); const body = await request.json();
    if (body.fullName !== undefined) {
      const name = String(body.fullName).trim(); if (name.length < 3 || name.length > 160) return Response.json({ error: "الاسم غير صالح" }, { status: 400 });
      await db.update(users).set({ fullName: name, updatedAt: new Date() }).where(eq(users.id, user.id));
    }
    await db.update(profiles).set({ studentNumber: body.studentNumber?.trim() || null, groupName: body.groupName?.trim() || null, updatedAt: new Date() }).where(eq(profiles.userId, user.id));
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(); const body = await request.json();
    const record = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    if (!record || !(await bcrypt.compare(String(body.password || ""), record.passwordHash))) return Response.json({ error: "كلمة المرور غير صحيحة" }, { status: 403 });
    await db.transaction(async (tx) => {
      await tx.update(users).set({ email: `deleted-${user.id}@invalid.local`, fullName: "حساب محذوف", isActive: false, deletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
    });
    await destroySession();
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
