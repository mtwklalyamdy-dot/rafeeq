import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { courseContents, courses, profiles } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    
    // Filter strictly based on student's current department and level
    const rows = await db.select({ id: courses.id, name: courses.nameAr, nameEn: courses.nameEn, code: courses.code, creditHours: courses.creditHours, description: courses.description, levelId: courses.levelId })
      .from(courses)
      .where(and(
        eq(courses.isActive, true),
        profile?.departmentId ? eq(courses.departmentId, profile.departmentId) : undefined,
        profile?.levelId ? eq(courses.levelId, profile.levelId) : undefined
      ))
      .orderBy(asc(courses.nameAr));
    return Response.json({ courses: rows });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return Response.json({ error: "هذه العملية للإدارة فقط" }, { status: 403 });
    const body = await request.json();
    if (!body.nameAr?.trim() || !body.code?.trim()) return Response.json({ error: "الاسم والرمز مطلوبان" }, { status: 400 });
    const [course] = await db.insert(courses).values({ nameAr: body.nameAr.trim(), nameEn: body.nameEn?.trim() || null, code: body.code.trim().toUpperCase(), creditHours: Math.max(0, Number(body.creditHours) || 0), description: body.description?.trim() || null, departmentId: body.departmentId || null, levelId: body.levelId || null, semesterId: body.semesterId || null }).returning();
    return Response.json({ course }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
