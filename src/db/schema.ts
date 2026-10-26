import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const userRole = pgEnum("user_role", ["student", "representative", "support", "admin"]);
export const contentKind = pgEnum("content_kind", ["lecture", "summary", "book", "reference", "exam_model", "text"]);
export const publicationStatus = pgEnum("publication_status", ["draft", "pending", "published", "rejected", "archived"]);
export const assignmentStatus = pgEnum("assignment_status", ["draft", "pending", "published", "closed"]);
export const submissionStatus = pgEnum("submission_status", ["draft", "submitted", "returned", "graded"]);
export const questionType = pgEnum("question_type", ["multiple_choice", "true_false", "text", "numeric"]);
export const ticketStatus = pgEnum("ticket_status", ["open", "waiting", "in_progress", "resolved", "closed"]);
export const postStatus = pgEnum("post_status", ["new", "waiting", "answered", "solved", "hidden"]);
export const processingStatus = pgEnum("processing_status", ["queued", "processing", "completed", "failed"]);
export const verificationPurpose = pgEnum("verification_purpose", ["verify_email", "reset_password"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").default("student").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_unique").on(t.email), index("users_role_idx").on(t.role)]);

export const colleges = pgTable("colleges", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: varchar("name_ar", { length: 180 }).notNull(),
  nameEn: varchar("name_en", { length: 180 }),
  university: varchar("university", { length: 180 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  collegeId: uuid("college_id").references(() => colleges.id, { onDelete: "cascade" }).notNull(),
  nameAr: varchar("name_ar", { length: 180 }).notNull(),
  nameEn: varchar("name_en", { length: 180 }),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (t) => [index("departments_college_idx").on(t.collegeId)]);

export const levels = pgTable("levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: varchar("name_ar", { length: 80 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const semesters = pgTable("semesters", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  academicYear: varchar("academic_year", { length: 20 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isCurrent: boolean("is_current").default(false).notNull(),
  ...timestamps,
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  university: varchar("university", { length: 180 }).notNull(),
  collegeId: uuid("college_id").references(() => colleges.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "set null" }),
  semesterId: uuid("semester_id").references(() => semesters.id, { onDelete: "set null" }),
  studentNumber: varchar("student_number", { length: 80 }),
  groupName: varchar("group_name", { length: 80 }),
  avatarUrl: text("avatar_url"),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  userAgent: text("user_agent"),
  ipHash: varchar("ip_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("sessions_token_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]);

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  purpose: verificationPurpose("purpose").notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(5).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("email_verification_user_idx").on(t.userId, t.purpose)]);

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "set null" }),
  semesterId: uuid("semester_id").references(() => semesters.id, { onDelete: "set null" }),
  nameAr: varchar("name_ar", { length: 180 }).notNull(),
  nameEn: varchar("name_en", { length: 180 }),
  code: varchar("code", { length: 40 }).notNull(),
  creditHours: integer("credit_hours").default(0).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("courses_code_unique").on(t.code), index("courses_level_idx").on(t.levelId)]);

export const enrollments = pgTable("enrollments", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId] }), index("enrollments_course_idx").on(t.courseId)]);

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  storageKey: text("storage_key").notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  scanStatus: varchar("scan_status", { length: 30 }).default("validated").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("files_storage_key_unique").on(t.storageKey), index("files_owner_idx").on(t.ownerId)]);

export const courseContents = pgTable("course_contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  body: text("body"),
  kind: contentKind("kind").notNull(),
  status: publicationStatus("status").default("pending").notNull(),
  sourceLabel: varchar("source_label", { length: 180 }),
  allowDownload: boolean("allow_download").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("course_contents_course_idx").on(t.courseId, t.status), index("course_contents_author_idx").on(t.authorId)]);

export const contentFavorites = pgTable("content_favorites", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contentId: uuid("content_id").references(() => courseContents.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.contentId] })]);

export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description").notNull(),
  targetLevelId: uuid("target_level_id").references(() => levels.id, { onDelete: "set null" }),
  targetGroup: varchar("target_group", { length: 80 }),
  status: assignmentStatus("status").default("pending").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  maxScore: numeric("max_score", { precision: 7, scale: 2 }).default("100").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("assignments_course_due_idx").on(t.courseId, t.dueAt)]);

export const assignmentAttachments = pgTable("assignment_attachments", {
  assignmentId: uuid("assignment_id").references(() => assignments.id, { onDelete: "cascade" }).notNull(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.assignmentId, t.fileId] })]);

export const assignmentSubmissions = pgTable("assignment_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id").references(() => assignments.id, { onDelete: "cascade" }).notNull(),
  studentId: uuid("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  answerText: text("answer_text"),
  answerFileId: uuid("answer_file_id").references(() => files.id, { onDelete: "set null" }),
  status: submissionStatus("status").default("draft").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  score: numeric("score", { precision: 7, scale: 2 }),
  teacherNotes: text("teacher_notes"),
  ...timestamps,
}, (t) => [uniqueIndex("submission_student_assignment_unique").on(t.assignmentId, t.studentId), index("submissions_student_idx").on(t.studentId)]);

export const exams = pgTable("exams", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  instructions: text("instructions"),
  durationMinutes: integer("duration_minutes").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isPublished: boolean("is_published").default(false).notNull(),
  showCorrectAnswers: boolean("show_correct_answers").default(false).notNull(),
  ...timestamps,
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").references(() => exams.id, { onDelete: "cascade" }).notNull(),
  type: questionType("type").notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>(),
  correctAnswer: jsonb("correct_answer").notNull(),
  points: numeric("points", { precision: 7, scale: 2 }).default("1").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, (t) => [index("questions_exam_idx").on(t.examId, t.sortOrder)]);

export const examAttempts = pgTable("exam_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").references(() => exams.id, { onDelete: "cascade" }).notNull(),
  studentId: uuid("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  score: numeric("score", { precision: 8, scale: 2 }),
  isFinal: boolean("is_final").default(false).notNull(),
}, (t) => [uniqueIndex("attempt_exam_student_unique").on(t.examId, t.studentId)]);

export const examAnswers = pgTable("exam_answers", {
  attemptId: uuid("attempt_id").references(() => examAttempts.id, { onDelete: "cascade" }).notNull(),
  questionId: uuid("question_id").references(() => questions.id, { onDelete: "cascade" }).notNull(),
  answer: jsonb("answer"),
  awardedPoints: numeric("awarded_points", { precision: 7, scale: 2 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.attemptId, t.questionId] })]);

export const grades = pgTable("grades", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  assignmentScore: numeric("assignment_score", { precision: 7, scale: 2 }),
  examScore: numeric("exam_score", { precision: 7, scale: 2 }),
  finalScore: numeric("final_score", { precision: 7, scale: 2 }),
  letterGrade: varchar("letter_grade", { length: 20 }),
  ...timestamps,
}, (t) => [uniqueIndex("grade_student_course_unique").on(t.studentId, t.courseId)]);

export const attendance = pgTable("attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  attendedOn: timestamp("attended_on", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
});

export const schedules = pgTable("schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "cascade" }).notNull(),
  groupName: varchar("group_name", { length: 80 }),
  dayOfWeek: integer("day_of_week").notNull(),
  startsAt: varchar("starts_at", { length: 5 }).notNull(),
  endsAt: varchar("ends_at", { length: 5 }).notNull(),
  room: varchar("room", { length: 100 }),
  instructor: varchar("instructor", { length: 160 }),
  ...timestamps,
}, (t) => [index("schedules_level_day_idx").on(t.levelId, t.dayOfWeek)]);

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  kind: varchar("kind", { length: 40 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isOfficial: boolean("is_official").default(false).notNull(),
  ...timestamps,
});

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 80 }),
  clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true }).notNull(),
  version: integer("version").default(1).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("notes_user_idx").on(t.userId, t.updatedAt)]);

export const studyPlans = pgTable("study_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  items: jsonb("items").$type<Array<{ title: string; done: boolean; dueAt?: string }>>().default([]).notNull(),
  progress: integer("progress").default(0).notNull(),
  ...timestamps,
});

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }).notNull(),
  body: text("body").notNull(),
  targetCollegeId: uuid("target_college_id").references(() => colleges.id, { onDelete: "set null" }),
  targetLevelId: uuid("target_level_id").references(() => levels.id, { onDelete: "set null" }),
  targetGroup: varchar("target_group", { length: 80 }),
  isPublished: boolean("is_published").default(false).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  body: text("body").notNull(),
  kind: varchar("kind", { length: 50 }).notNull(),
  resourceId: uuid("resource_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.readAt)]);

export const telegramChannels = pgTable("telegram_channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description"),
  url: text("url"),
  isActive: boolean("is_active").default(true).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...timestamps,
});

export const communityCategories = pgTable("community_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: varchar("name_ar", { length: 140 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("community_category_slug_unique").on(t.slug)]);

export const communityPosts = pgTable("community_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => communityCategories.id, { onDelete: "restrict" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }).notNull(),
  body: text("body").notNull(),
  status: postStatus("status").default("new").notNull(),
  isAiGenerated: boolean("is_ai_generated").default(false).notNull(),
  solvedCommentId: uuid("solved_comment_id"),
  ...timestamps,
}, (t) => [index("community_posts_category_idx").on(t.categoryId, t.createdAt), index("community_posts_author_idx").on(t.authorId)]);

export const communityComments = pgTable("community_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => communityPosts.id, { onDelete: "cascade" }).notNull(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  body: text("body").notNull(),
  isAiGenerated: boolean("is_ai_generated").default(false).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  ...timestamps,
}, (t) => [index("community_comments_post_idx").on(t.postId, t.createdAt)]);

export const communityReactions = pgTable("community_reactions", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  commentId: uuid("comment_id").references(() => communityComments.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.commentId] })]);

export const communityReports = pgTable("community_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  postId: uuid("post_id").references(() => communityPosts.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").references(() => communityComments.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 30 }).default("open").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const communitySaves = pgTable("community_saves", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  postId: uuid("post_id").references(() => communityPosts.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.postId] })]);

export const representatives = pgTable("representatives", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  levelId: uuid("level_id").references(() => levels.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  semesterId: uuid("semester_id").references(() => semesters.id, { onDelete: "set null" }),
  groupName: varchar("group_name", { length: 80 }),
  approvalStatus: varchar("approval_status", { length: 30 }).default("pending").notNull(),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  ...timestamps,
});

export const representativeAssignments = pgTable("representative_assignments", {
  representativeId: uuid("representative_id").references(() => representatives.userId, { onDelete: "cascade" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  canPublishDirectly: boolean("can_publish_directly").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.representativeId, t.courseId] })]);

export const representativePublications = pgTable("representative_publications", {
  id: uuid("id").defaultRandom().primaryKey(),
  representativeId: uuid("representative_id").references(() => representatives.userId, { onDelete: "cascade" }).notNull(),
  contentId: uuid("content_id").references(() => courseContents.id, { onDelete: "cascade" }),
  assignmentId: uuid("assignment_id").references(() => assignments.id, { onDelete: "cascade" }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const supportAgents = pgTable("support_agents", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  isAvailable: boolean("is_available").default(false).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  assignedAgentId: uuid("assigned_agent_id").references(() => supportAgents.userId, { onDelete: "set null" }),
  type: varchar("type", { length: 80 }).notNull(),
  subject: varchar("subject", { length: 240 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatus("status").default("open").notNull(),
  ...timestamps,
}, (t) => [index("tickets_user_idx").on(t.userId, t.createdAt), index("tickets_agent_idx").on(t.assignedAgentId, t.status)]);

export const supportConversations = pgTable("support_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  assignedAgentId: uuid("assigned_agent_id").references(() => supportAgents.userId, { onDelete: "set null" }),
  status: ticketStatus("status").default("open").notNull(),
  ...timestamps,
});

export const supportMessages = pgTable("support_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => supportConversations.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  body: text("body").notNull(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  isInternal: boolean("is_internal").default(false).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("support_messages_conversation_idx").on(t.conversationId, t.createdAt)]);

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  assistantType: varchar("assistant_type", { length: 40 }).default("academic").notNull(),
  ...timestamps,
});

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  provider: varchar("provider", { length: 50 }),
  model: varchar("model", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiStudySummaries = pgTable("ai_study_summaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  sourceFileId: uuid("source_file_id").references(() => files.id, { onDelete: "set null" }),
  sourceType: varchar("source_type", { length: 40 }).notNull(),
  summaryType: varchar("summary_type", { length: 40 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  sourceText: text("source_text"),
  content: text("content").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  ...timestamps,
});

export const audioTranscriptions = pgTable("audio_transcriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sourceFileId: uuid("source_file_id").references(() => files.id, { onDelete: "restrict" }).notNull(),
  language: varchar("language", { length: 20 }),
  transcript: text("transcript"),
  editedTranscript: text("edited_transcript"),
  status: processingStatus("status").default("queued").notNull(),
  provider: varchar("provider", { length: 50 }),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const aiProcessingJobs = pgTable("ai_processing_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  kind: varchar("kind", { length: 40 }).notNull(),
  status: processingStatus("status").default("queued").notNull(),
  input: jsonb("input").notNull(),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  attempts: integer("attempts").default(0).notNull(),
  ...timestamps,
});

export const syncOperations = pgTable("sync_operations", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  operation: varchar("operation", { length: 20 }).notNull(),
  clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  result: jsonb("result"),
}, (t) => [index("sync_operations_user_idx").on(t.userId, t.processedAt)]);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const academicTerms = pgTable("academic_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  termAr: varchar("term_ar", { length: 180 }).notNull(),
  termEn: varchar("term_en", { length: 180 }).notNull(),
  meaning: text("meaning").notNull(),
  simpleExplanation: text("simple_explanation"),
  example: text("example"),
  category: varchar("category", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (t) => [index("academic_terms_ar_idx").on(t.termAr), index("academic_terms_en_idx").on(t.termEn), index("academic_terms_category_idx").on(t.category)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("audit_logs_actor_idx").on(t.actorId, t.createdAt)]);
