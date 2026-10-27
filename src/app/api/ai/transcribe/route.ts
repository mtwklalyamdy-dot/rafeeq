import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { audioTranscriptions, files } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";
import { generateWithGemini, GeminiError } from "@/lib/gemini";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { loadPrivateFile } from "@/lib/storage";

const audioTypes = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg"]);

export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    const user = await requireUser();
    const rate = await checkRateLimit("audio-transcription", 5, 60 * 60 * 1000, user.id);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const body = await request.json();
    const file = await db.query.files.findFirst({ where: and(eq(files.id, body.fileId), eq(files.ownerId, user.id)) });
    if (!file) return Response.json({ error: "التسجيل غير موجود أو لا تملكه" }, { status: 403 });
    if (!audioTypes.has(file.mimeType) || file.sizeBytes > 10 * 1024 * 1024) return Response.json({ error: "يدعم MP3 وM4A وWAV وWebM وOGG حتى 10 ميجابايت" }, { status: 400 });
    const [job] = await db.insert(audioTranscriptions).values({ userId: user.id, sourceFileId: file.id, language: body.language || "ar", status: "processing" }).returning();
    jobId = job.id;
    const bytes = await loadPrivateFile(file.storageKey);
    const result = await generateWithGemini({
      system: "أنت ناسخ صوت أمين. اكتب فقط الكلام المسموع دون اختلاق. استخدم [غير واضح] عند عدم وضوح جزء.",
      prompt: `حوّل هذا التسجيل إلى نص كامل باللغة ${body.language === "en" ? "الإنجليزية" : "العربية"}. لا تلخصه ولا تضف محتوى.`,
      inlineData: { mimeType: file.mimeType, data: bytes.toString("base64") },
    });
    const [transcription] = await db.update(audioTranscriptions).set({ transcript: result.text, editedTranscript: result.text, status: "completed", provider: result.provider, updatedAt: new Date() }).where(eq(audioTranscriptions.id, job.id)).returning();
    return Response.json({ transcription, provider: result.provider }, { status: 201 });
  } catch (error) {
    if (jobId) await db.update(audioTranscriptions).set({ status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "فشلت المعالجة", updatedAt: new Date() }).where(eq(audioTranscriptions.id, jobId));
    if (error instanceof GeminiError) return Response.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
