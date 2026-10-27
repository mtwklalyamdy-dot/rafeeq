import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiStudySummaries, files } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";
import { generateWithGemini, GeminiError } from "@/lib/gemini";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { loadPrivateFile } from "@/lib/storage";

const allowedTypes = new Set(["short", "medium", "detailed", "headings", "key_points", "definitions", "equations", "qa", "mcq", "true_false", "flashcards", "simple", "terms_translation"]);

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const rate = await checkRateLimit("ai-summary", 8, 60 * 60 * 1000, user.id);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const body = await request.json();
    const summaryType = allowedTypes.has(body.summaryType) ? body.summaryType : "medium";
    const title = String(body.title || "ملخص دراسي").trim().slice(0, 240);
    let sourceText: string | null = null;
    let sourceFileId: string | null = null;
    let inlineData: { mimeType: string; data: string } | undefined;
    if (body.fileId) {
      const file = await db.query.files.findFirst({ where: and(eq(files.id, body.fileId), eq(files.ownerId, user.id)) });
      if (!file) return Response.json({ error: "الملف غير موجود أو لا تملكه" }, { status: 403 });
      const bytes = await loadPrivateFile(file.storageKey);
      sourceFileId = file.id;
      if (file.mimeType === "text/plain") sourceText = bytes.toString("utf8").slice(0, 120_000);
      else if (["application/pdf", "image/jpeg", "image/png"].includes(file.mimeType)) inlineData = { mimeType: file.mimeType, data: bytes.toString("base64") };
      else return Response.json({ error: "التلخيص يدعم النص وPDF والصور فقط" }, { status: 400 });
    } else {
      sourceText = String(body.text || "").trim();
      if (sourceText.length < 20 || sourceText.length > 120_000) return Response.json({ error: "النص يجب أن يكون بين 20 و120000 حرف" }, { status: 400 });
    }
    const labels: Record<string, string> = { short: "قصير", medium: "متوسط", detailed: "مفصل", headings: "حسب العناوين", key_points: "أهم النقاط", definitions: "التعريفات والمصطلحات", equations: "القوانين والمعادلات", qa: "أسئلة وأجوبة", mcq: "أسئلة اختيار من متعدد", true_false: "صح وخطأ", flashcards: "بطاقات تعليمية", simple: "شرح مبسط", terms_translation: "ترجمة المصطلحات" };
    const prompt = `حلّل المصدر المرفق أو النص ثم أنشئ ناتجًا دراسيًا عربيًا من نوع: ${labels[summaryType]}. التزم بالمصدر وحده ولا تضف معلومات غير موجودة. إذا تعذر قراءة المصدر فقل ذلك صراحة. ${sourceText ? `\nالمصدر:\n${sourceText}` : ""}`;
    const result = await generateWithGemini({ prompt, system: "أنت أداة تلخيص أكاديمية أمينة. لا تختلق محتوى غير موجود في المصدر.", inlineData });
    const [summary] = await db.insert(aiStudySummaries).values({ userId: user.id, courseId: body.courseId || null, sourceFileId, sourceType: sourceFileId ? "file" : "text", summaryType, title, sourceText: sourceText?.slice(0, 120_000) || null, content: result.text, provider: result.provider, model: result.model }).returning();
    return Response.json({ summary, disclaimer: "راجع الملخص مقابل المصدر قبل الاعتماد عليه." }, { status: 201 });
  } catch (error) {
    if (error instanceof GeminiError) return Response.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
