const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateWithGemini(input: {
  prompt: string;
  system?: string;
  inlineData?: { mimeType: string; data: string };
}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("خدمة الذكاء الاصطناعي غير مهيأة. يلزم إضافة GEMINI_API_KEY إلى أسرار الخادم.", 503);
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
    if (input.inlineData) parts.unshift({ inlineData: input.inlineData });
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: input.system ? { parts: [{ text: input.system }] } : undefined,
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
        signal: controller.signal,
      },
    );
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string; status?: string };
    };
    if (!response.ok) {
      if (response.status === 429) throw new GeminiError("تم بلوغ حد استخدام الذكاء الاصطناعي مؤقتًا. حاول لاحقًا أو ارفع حصة Gemini.", 429);
      if (response.status === 404) throw new GeminiError("نموذج Gemini المضبوط غير متاح حاليًا. راجع GEMINI_MODEL في إعدادات الخادم.", 503);
      throw new GeminiError(data.error?.message || "رفض مزود Gemini الطلب.", 502);
    }
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!text) throw new GeminiError("لم يُرجع مزود Gemini نصًا صالحًا.", 502);
    return { text, provider: "Google Gemini", model };
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new GeminiError("انتهت مهلة خدمة الذكاء الاصطناعي.", 504);
    throw new GeminiError("تعذر الاتصال بخدمة Gemini.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
