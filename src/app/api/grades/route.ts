import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, courses, grades } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.select({ id: grades.id, courseName: courses.nameAr, creditHours: courses.creditHours, assignmentScore: grades.assignmentScore, examScore: grades.examScore, finalScore: grades.finalScore, letterGrade: grades.letterGrade }).from(grades).innerJoin(courses, eq(grades.courseId, courses.id)).where(eq(grades.studentId, user.id));
    const valid = rows.filter((row) => row.finalScore !== null && row.creditHours > 0);
    const totalCredits = valid.reduce((sum, row) => sum + row.creditHours, 0);
    const weightedAverage = totalCredits ? valid.reduce((sum, row) => sum + Number(row.finalScore) * row.creditHours, 0) / totalCredits : null;
    const scale = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "gpa_scale") });
    return Response.json({ grades: rows, weightedAverage, totalCredits, gpa: null, gpaStatus: scale ? "يتطلب تطبيق سلم الجامعة المعتمد" : "لم تضبط الإدارة سلم GPA بعد" });
  } catch (error) { return errorResponse(error); }
}
