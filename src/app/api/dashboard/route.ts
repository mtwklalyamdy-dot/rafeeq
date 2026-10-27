import { and, asc, count, desc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { announcements, assignments, courseContents, courses, enrollments, notifications, profiles, schedules, studyPlans } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id), with: undefined });
    const courseFilter = and(
      profile?.departmentId ? eq(courses.departmentId, profile.departmentId) : undefined,
      profile?.levelId ? eq(courses.levelId, profile.levelId) : undefined
    );
    const currentCourses = await db.select({ id: courses.id, name: courses.nameAr, code: courses.code, creditHours: courses.creditHours })
      .from(courses)
      .where(and(eq(courses.isActive, true), courseFilter)).orderBy(asc(courses.nameAr)).limit(8);
    const courseIds = currentCourses.map((course) => course.id);
    const upcomingAssignments = courseIds.length === 0 ? [] : await db.select({ id: assignments.id, title: assignments.title, dueAt: assignments.dueAt, courseName: courses.nameAr })
      .from(assignments).innerJoin(courses, eq(assignments.courseId, courses.id))
      .where(and(
        eq(assignments.status, "published"), 
        gte(assignments.dueAt, new Date()),
        profile?.departmentId ? eq(courses.departmentId, profile.departmentId) : undefined,
        profile?.levelId ? eq(courses.levelId, profile.levelId) : undefined
      ))
      .orderBy(asc(assignments.dueAt)).limit(5);
    const latestContent = courseIds.length === 0 ? [] : await db.select({ id: courseContents.id, title: courseContents.title, kind: courseContents.kind, updatedAt: courseContents.updatedAt, courseName: courses.nameAr })
      .from(courseContents).innerJoin(courses, eq(courseContents.courseId, courses.id))
      .where(and(
        eq(courseContents.status, "published"), 
        profile?.departmentId ? eq(courses.departmentId, profile.departmentId) : undefined,
        profile?.levelId ? eq(courses.levelId, profile.levelId) : undefined
      )).orderBy(desc(courseContents.publishedAt)).limit(5);
    const latestAnnouncements = await db.select({ id: announcements.id, title: announcements.title, body: announcements.body, publishedAt: announcements.publishedAt })
      .from(announcements).where(and(eq(announcements.isPublished, true), profile?.levelId ? or(eq(announcements.targetLevelId, profile.levelId), isNull(announcements.targetLevelId)) : isNull(announcements.targetLevelId)))
      .orderBy(desc(announcements.publishedAt)).limit(4);
    const today = new Date().getDay();
    const todaySchedule = profile?.levelId ? await db.select({ id: schedules.id, dayOfWeek: schedules.dayOfWeek, startsAt: schedules.startsAt, endsAt: schedules.endsAt, room: schedules.room, instructor: schedules.instructor, courseName: courses.nameAr })
      .from(schedules).innerJoin(courses, eq(schedules.courseId, courses.id)).where(and(eq(schedules.levelId, profile.levelId), eq(schedules.dayOfWeek, today))).orderBy(asc(schedules.startsAt)) : [];
    const [notificationCount] = await db.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    const plans = await db.select().from(studyPlans).where(eq(studyPlans.userId, user.id)).orderBy(desc(studyPlans.updatedAt)).limit(1);
    return Response.json({ user, courses: currentCourses, assignments: upcomingAssignments, content: latestContent, announcements: latestAnnouncements, schedule: todaySchedule, unreadNotifications: notificationCount?.value ?? 0, studyPlan: plans[0] || null, serverTime: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
