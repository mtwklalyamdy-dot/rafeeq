import { randomInt, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { colleges, departments, emailVerifications, levels, profiles, representatives, semesters, users } from "@/db/schema";
import { hashOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mail";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { firstZodError } from "@/lib/utils";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    const input = parsed.data;
    const rate = await checkRateLimit("register", 5, 15 * 60 * 1000, input.email);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const existing = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
    if (existing) return Response.json({ error: "البريد الإلكتروني مسجل بالفعل" }, { status: 409 });

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const code = String(randomInt(100000, 1000000));
    const codeHash = await hashOtp(userId, "verify_email", code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await db.transaction(async (tx) => {
      let college = await tx.query.colleges.findFirst({ where: and(eq(colleges.nameAr, input.college), eq(colleges.university, input.university)) });
      if (!college) [college] = await tx.insert(colleges).values({ nameAr: input.college, university: input.university }).returning();

      let department = await tx.query.departments.findFirst({ where: and(eq(departments.collegeId, college.id), eq(departments.nameAr, input.department)) });
      if (!department) [department] = await tx.insert(departments).values({ collegeId: college.id, nameAr: input.department }).returning();

      const levelNames: Record<number, string> = { 1: "المستوى الأول", 2: "المستوى الثاني", 3: "المستوى الثالث", 4: "المستوى الرابع" };
      const levelName = levelNames[input.level] || `المستوى ${input.level}`;
      let level = await tx.query.levels.findFirst({ where: eq(levels.nameAr, levelName) });
      if (!level) [level] = await tx.insert(levels).values({ nameAr: levelName, sortOrder: input.level }).returning();

      const semesterName = `الفصل ${input.semester}`;
      const academicYear = String(new Date().getFullYear());
      let semester = await tx.query.semesters.findFirst({ where: and(eq(semesters.nameAr, semesterName), eq(semesters.academicYear, academicYear)) });
      if (!semester) [semester] = await tx.insert(semesters).values({ nameAr: semesterName, academicYear }).returning();

      const [created] = await tx.insert(users).values({ id: userId, fullName: input.fullName, email: input.email, passwordHash, role: input.accountType }).returning();
      await tx.insert(profiles).values({ userId: created.id, university: input.university, collegeId: college.id, departmentId: department.id, levelId: level.id, semesterId: semester.id });
      if (input.accountType === "representative") {
        await tx.insert(representatives).values({ userId: created.id, levelId: level.id, departmentId: department.id, semesterId: semester.id, approvalStatus: "pending" });
      }
      await tx.insert(emailVerifications).values({ userId: created.id, purpose: "verify_email", codeHash, expiresAt });
      return created;
    });

    try {
      await sendOtpEmail({ email: user.email, name: user.fullName, code, purpose: "verify_email" });
      return Response.json({ ok: true, mailSent: true, message: "تم إنشاء الحساب وإرسال رمز التحقق إلى بريدك." }, { status: 201 });
    } catch (error) {
      return Response.json({ ok: true, mailSent: false, message: error instanceof Error ? error.message : "تم إنشاء الحساب لكن تعذر إرسال الرمز." }, { status: 201 });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Registration failed");
    return Response.json({ error: "تعذر إنشاء الحساب حاليًا" }, { status: 500 });
  }
}
