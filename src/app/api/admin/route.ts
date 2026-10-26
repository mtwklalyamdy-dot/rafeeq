import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { readdir, stat } from "fs/promises";
import path from "path";
import { db } from "@/db";
import {
  announcements,
  appSettings,
  assignments,
  auditLogs,
  colleges,
  communityCategories,
  communityComments,
  communityPosts,
  communityReports,
  courseContents,
  courses,
  departments,
  exams,
  levels,
  profiles,
  representativeAssignments,
  representatives,
  semesters,
  supportAgents,
  supportConversations,
  supportTickets,
  users,
} from "@/db/schema";
import { effectiveRole, errorResponse, requireRole } from "@/lib/auth";

const allowedTables = [
  "users", "profiles", "sessions", "email_verifications", "colleges", "departments", 
  "levels", "semesters", "courses", "enrollments", "files", "course_contents", 
  "content_favorites", "assignments", "assignment_attachments", "assignment_submissions", 
  "exams", "questions", "exam_attempts", "exam_answers", "grades", "attendance", 
  "schedules", "calendar_events", "notes", "study_plans", "announcements", 
  "notifications", "telegram_channels", "community_categories", "community_posts", 
  "community_comments", "community_reactions", "community_reports", "community_saves", 
  "representatives", "representative_assignments", "representative_publications", 
  "support_agents", "support_tickets", "support_conversations", "support_messages", 
  "ai_conversations", "ai_messages", "ai_study_summaries", "audio_transcriptions", 
  "ai_processing_jobs", "sync_operations", "app_settings", "audit_logs"
 ];

// Only single-row, content-level entities may be removed through the DB browser.
const deletableTables = new Set(["calendar_events", "notes", "telegram_channels", "academic_terms"]);

const secretColumn = /(password|token|code_hash|secret|private_key|endpoint|storage_key|ip_hash)/i;

function sanitizeTableName(table: string) {
  if (allowedTables.includes(table)) return table;
  throw new Error("اسم الجدول غير صالح");
}

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const url = new URL(request.url);
    const selectedTable = url.searchParams.get("table");

    // 1. If requesting a specific table's rows
    if (selectedTable) {
      const sanitized = sanitizeTableName(selectedTable);
      const queryResult = await db.execute(sql.raw(`SELECT * FROM "${sanitized}" LIMIT 100`));
      const rows = queryResult.rows.map((row) => Object.fromEntries(
        Object.entries(row as Record<string, unknown>).map(([column, value]) => [column, secretColumn.test(column) ? "[محجوب]" : value])
      ));
      return Response.json({ table: sanitized, rows, canDelete: deletableTables.has(sanitized) });
    }

    // 2. Base counters
    const [[userCount], [courseCount], [contentCount], [assignmentCount], [ticketCount], [reportCount]] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(courses),
      db.select({ value: count() }).from(courseContents),
      db.select({ value: count() }).from(assignments),
      db.select({ value: count() }).from(supportTickets),
      db.select({ value: count() }).from(communityReports),
    ]);

    // 3. User lists (Up to 250 users)
    const accountRows = await db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
      university: profiles.university,
      studentNumber: profiles.studentNumber,
      groupName: profiles.groupName,
      collegeId: profiles.collegeId,
      collegeName: colleges.nameAr,
      departmentId: profiles.departmentId,
      departmentName: departments.nameAr,
      levelId: profiles.levelId,
      levelName: levels.nameAr,
      semesterId: profiles.semesterId,
      semesterName: semesters.nameAr,
      representativeStatus: representatives.approvalStatus,
    }).from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(colleges, eq(profiles.collegeId, colleges.id))
      .leftJoin(departments, eq(profiles.departmentId, departments.id))
      .leftJoin(levels, eq(profiles.levelId, levels.id))
      .leftJoin(semesters, eq(profiles.semesterId, semesters.id))
      .leftJoin(representatives, eq(representatives.userId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(250);

    const accountRowsWithEffectiveRoles = accountRows.map((row) => ({ ...row, role: effectiveRole(row.email, row.role) }));
    const pendingRepresentatives = accountRowsWithEffectiveRoles.filter((row) => row.role === "representative" && row.representativeStatus === "pending");
    const managers = accountRowsWithEffectiveRoles.filter((row) => row.role === "admin").map((row) => ({ ...row, protectedByEnvironment: effectiveRole(row.email, "student") === "admin" }));
    const supportStaff = await db.select({ id: users.id, fullName: users.fullName, email: users.email, isActive: users.isActive, emailVerifiedAt: users.emailVerifiedAt, isAvailable: supportAgents.isAvailable, lastSeenAt: supportAgents.lastSeenAt })
      .from(users).leftJoin(supportAgents, eq(supportAgents.userId, users.id)).where(eq(users.role, "support")).orderBy(desc(users.createdAt));

    // 4. Support tickets list
    const tickets = await db.select({
      id: supportTickets.id,
      userId: supportTickets.userId,
      userName: users.fullName,
      userEmail: users.email,
      type: supportTickets.type,
      subject: supportTickets.subject,
      description: supportTickets.description,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      conversationId: supportConversations.id,
    }).from(supportTickets)
      .innerJoin(users, eq(supportTickets.userId, users.id))
      .leftJoin(supportConversations, eq(supportConversations.ticketId, supportTickets.id))
      .orderBy(desc(supportTickets.updatedAt))
      .limit(200);

    const [contentRows, assignmentRows, examRows, postRows, commentRows, announcementRows, auditRows, settingRows] = await Promise.all([
      db.select({ id: courseContents.id, courseId: courseContents.courseId, courseName: courses.nameAr, title: courseContents.title, kind: courseContents.kind, status: courseContents.status, authorId: courseContents.authorId, updatedAt: courseContents.updatedAt })
        .from(courseContents).innerJoin(courses, eq(courses.id, courseContents.courseId)).orderBy(desc(courseContents.updatedAt)).limit(200),
      db.select({ id: assignments.id, courseId: assignments.courseId, courseName: courses.nameAr, title: assignments.title, status: assignments.status, dueAt: assignments.dueAt, authorId: assignments.authorId, updatedAt: assignments.updatedAt })
        .from(assignments).innerJoin(courses, eq(courses.id, assignments.courseId)).orderBy(desc(assignments.updatedAt)).limit(200),
      db.select({ id: exams.id, courseId: exams.courseId, courseName: courses.nameAr, title: exams.title, isPublished: exams.isPublished, startsAt: exams.startsAt, endsAt: exams.endsAt, durationMinutes: exams.durationMinutes, updatedAt: exams.updatedAt })
        .from(exams).innerJoin(courses, eq(courses.id, exams.courseId)).orderBy(desc(exams.updatedAt)).limit(200),
      db.select({ id: communityPosts.id, title: communityPosts.title, status: communityPosts.status, authorId: users.id, authorName: users.fullName, categoryId: communityCategories.id, categoryName: communityCategories.nameAr, createdAt: communityPosts.createdAt, isAiGenerated: communityPosts.isAiGenerated })
        .from(communityPosts).innerJoin(users, eq(users.id, communityPosts.authorId)).innerJoin(communityCategories, eq(communityCategories.id, communityPosts.categoryId)).orderBy(desc(communityPosts.createdAt)).limit(200),
      db.select({ id: communityComments.id, postId: communityComments.postId, authorId: users.id, authorName: users.fullName, body: communityComments.body, isHidden: communityComments.isHidden, createdAt: communityComments.createdAt })
        .from(communityComments).innerJoin(users, eq(users.id, communityComments.authorId)).orderBy(desc(communityComments.createdAt)).limit(200),
      db.select({ id: announcements.id, title: announcements.title, body: announcements.body, isPublished: announcements.isPublished, targetCollegeId: announcements.targetCollegeId, targetLevelId: announcements.targetLevelId, targetGroup: announcements.targetGroup, authorId: announcements.authorId, publishedAt: announcements.publishedAt, updatedAt: announcements.updatedAt })
        .from(announcements).orderBy(desc(announcements.updatedAt)).limit(200),
      db.select({ id: auditLogs.id, actorId: auditLogs.actorId, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt })
        .from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100),
      db.select({ key: appSettings.key, value: appSettings.value, updatedAt: appSettings.updatedAt })
        .from(appSettings).where(inArray(appSettings.key, ["main_menu", "feature_flags", "app_updates"])),
    ]);

    // 5. Structure options
    const [collegeRows, departmentRows, levelRows, semesterRows, courseRows, representativeCourseRows] = await Promise.all([
      db.select({ id: colleges.id, name: colleges.nameAr, university: colleges.university }).from(colleges),
      db.select({ id: departments.id, name: departments.nameAr, collegeId: departments.collegeId }).from(departments),
      db.select({ id: levels.id, name: levels.nameAr }).from(levels),
      db.select({ id: semesters.id, name: semesters.nameAr, academicYear: semesters.academicYear }).from(semesters),
      db.select({ id: courses.id, name: courses.nameAr, code: courses.code }).from(courses),
      db.select({ representativeId: representativeAssignments.representativeId, courseId: representativeAssignments.courseId, canPublishDirectly: representativeAssignments.canPublishDirectly }).from(representativeAssignments),
    ]);

    // 6. DB Schema and stats
    const dbTablesQuery = await db.execute(sql`
      SELECT 
        relname AS table_name, 
        n_live_tup::int AS row_count 
      FROM 
        pg_stat_user_tables 
      WHERE 
        schemaname = 'public' 
      ORDER BY 
        relname;
    `);

    const dbColumnsQuery = await db.execute(sql`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable 
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
      ORDER BY 
        table_name, ordinal_position;
    `);

    // 7. Read backups
    let backupList: any[] = [];
    try {
      const dir = path.join(process.cwd(), "backups");
      const filesList = await readdir(dir);
      for (const f of filesList) {
        if (f.endsWith(".dump")) {
          const stats = await stat(path.join(dir, f));
          backupList.push({ name: f, size: stats.size, createdAt: stats.birthtime });
        }
      }
    } catch {}

    const settings = Object.fromEntries(settingRows.map((row) => [row.key, row.value]));

    return Response.json({
      counts: { users: userCount.value, courses: courseCount.value, content: contentCount.value, assignments: assignmentCount.value, tickets: ticketCount.value, reports: reportCount.value },
      pendingRepresentatives,
      managers,
      supportStaff: supportStaff.map((row) => ({ ...row, isAvailable: row.isAvailable || false })),
      users: accountRowsWithEffectiveRoles,
      tickets,
      content: contentRows,
      assignments: assignmentRows,
      exams: examRows,
      posts: postRows,
      comments: commentRows,
      announcements: announcementRows,
      auditLogs: auditRows,
      settings,
      options: { colleges: collegeRows, departments: departmentRows, levels: levelRows, semesters: semesterRows, courses: courseRows },
      representativeAssignments: representativeCourseRows,
      dbStats: {
        tables: dbTablesQuery.rows.map((row) => ({ ...row, canDelete: deletableTables.has(String(row.table_name)) })),
        columns: dbColumnsQuery.rows,
        backups: backupList,
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
