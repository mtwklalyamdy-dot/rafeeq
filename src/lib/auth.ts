import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { profiles, representatives, sessions, users } from "@/db/schema";
import { effectiveRole, isConfiguredAdmin } from "@/lib/admin-access";

const COOKIE_NAME = "rafeeq_session";
const SESSION_DAYS = 14;

export type AppRole = "student" | "representative" | "support" | "admin";

export { effectiveRole, isConfiguredAdmin };

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashOtp(userId: string, purpose: string, code: string) {
  return bcrypt.hash(`${userId}:${purpose}:${code}`, 12);
}

export async function verifyOtp(hash: string, userId: string, purpose: string, code: string) {
  return bcrypt.compare(`${userId}:${purpose}:${code}`, hash);
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(rawToken),
    expiresAt,
    userAgent: headerStore.get("user-agent")?.slice(0, 500),
    ipHash: sha256(ip),
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  cookieStore.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", expires: new Date(0) });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
      university: profiles.university,
      collegeId: profiles.collegeId,
      departmentId: profiles.departmentId,
      levelId: profiles.levelId,
      semesterId: profiles.semesterId,
      studentNumber: profiles.studentNumber,
      groupName: profiles.groupName,
      avatarUrl: profiles.avatarUrl,
      representativeStatus: representatives.approvalStatus,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .leftJoin(representatives, eq(users.id, representatives.userId))
    .where(and(
      eq(sessions.tokenHash, sha256(token)),
      gt(sessions.expiresAt, new Date()),
      eq(users.isActive, true),
      isNull(users.deletedAt),
    ))
    .limit(1);

  if (!rows[0]) return null;
  return { ...rows[0], role: effectiveRole(rows[0].email, rows[0].role) };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("يجب تسجيل الدخول أولًا", 401);
  if (!user.emailVerifiedAt) throw new AuthError("يجب توثيق البريد الإلكتروني", 403);
  return user;
}

export async function requireRole(...roles: AppRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("ليست لديك صلاحية لتنفيذ هذه العملية", 403);
  if (user.role === "representative" && user.representativeStatus !== "approved") {
    throw new AuthError("حساب المندوب غير معتمد حاليًا", 403);
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error instanceof Error ? error.message : "Unexpected server error");
  return Response.json({ error: "تعذر إتمام الطلب. حاول مرة أخرى." }, { status: 500 });
}
