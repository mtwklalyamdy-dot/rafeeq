import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, profiles, representativeAssignments, users } from "@/db/schema";
import { AuthError } from "@/lib/auth";

export async function requireRepresentativeCourse(representativeId: string, courseId: string) {
  const permission = await db.query.representativeAssignments.findFirst({
    where: and(eq(representativeAssignments.representativeId, representativeId), eq(representativeAssignments.courseId, courseId)),
  });
  if (!permission) throw new AuthError("هذه المادة غير مسندة إلى حسابك", 403);
  return permission;
}

export async function notifyAcademicTarget(input: {
  levelId: string | null;
  groupName?: string | null;
  title: string;
  body: string;
  kind: string;
  resourceId?: string | null;
  excludeUserId?: string;
}) {
  if (!input.levelId) return 0;
  const recipients = await db.select({ userId: profiles.userId })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(
      eq(profiles.levelId, input.levelId),
      input.groupName ? eq(profiles.groupName, input.groupName) : undefined,
      eq(users.isActive, true),
      eq(users.role, "student"),
    ));
  const unique = [...new Set(recipients.map((row) => row.userId).filter((id) => id !== input.excludeUserId))];
  if (!unique.length) return 0;
  await db.insert(notifications).values(unique.map((userId) => ({
    userId,
    title: input.title.slice(0, 240),
    body: input.body,
    kind: input.kind.slice(0, 50),
    resourceId: input.resourceId || null,
  })));
  return unique.length;
}
