import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations, aiMessages } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";
import { generateWithGemini, GeminiError } from "@/lib/gemini";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");

    if (conversationId) {
      // Fetch messages for a specific conversation
      const conversation = await db.query.aiConversations.findFirst({
        where: and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, user.id)),
      });
      if (!conversation) {
        return Response.json({ error: "المحادثة غير موجودة" }, { status: 404 });
      }
      const messages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .orderBy(aiMessages.createdAt);
      return Response.json({ conversation, messages });
    }

    // List all conversations
    const list = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.userId, user.id))
      .orderBy(desc(aiConversations.updatedAt));
    return Response.json({ conversations: list });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const rate = await checkRateLimit("ai-chat", 15, 60 * 60 * 1000, user.id);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const body = await request.json();
    const prompt = String(body.message || "").trim();
    if (prompt.length < 2 || prompt.length > 6000) return Response.json({ error: "يجب أن يكون السؤال بين حرفين و6000 حرف" }, { status: 400 });
    const assistantType = body.assistantType === "accounting" ? "accounting" : body.assistantType === "support" ? "support" : "academic";
    let conversation = body.conversationId ? await db.query.aiConversations.findFirst({ where: and(eq(aiConversations.id, body.conversationId), eq(aiConversations.userId, user.id)) }) : null;
    if (body.conversationId && !conversation) return Response.json({ error: "المحادثة غير موجودة" }, { status: 404 });
    if (!conversation) [conversation] = await db.insert(aiConversations).values({ userId: user.id, title: prompt.slice(0, 100), assistantType }).returning();
    const history = await db.select({ role: aiMessages.role, content: aiMessages.content }).from(aiMessages).where(eq(aiMessages.conversationId, conversation.id)).orderBy(aiMessages.createdAt).limit(12);
    const system = assistantType === "accounting"
      ? "أنت مساعد محاسبة تعليمي عربي. حلّل العملية المدخلة فعلاً وحدد المدين والدائن والمبلغ والسبب والأثر والقيد. لا تفترض تفاصيل غير مذكورة، واذكر أن المعالجة قد تختلف حسب السياسة والتفاصيل."
      : assistantType === "support"
        ? "أنت دليل استخدام لتطبيق رفيقي. اشرح خطوات الاستخدام فقط، ولا تدّع تنفيذ عمليات أو توفر خدمات. وجّه للدعم البشري عند الحاجة."
        : "أنت مساعد أكاديمي عربي لطلاب الجامعات في اليمن. اشرح بوضوح وبأمثلة تعليمية، ولا تختلق مراجع أو درجات، ونبّه لمراجعة القرارات الأكاديمية المهمة.";
    const contextualPrompt = `${history.map((item) => `${item.role === "user" ? "الطالب" : "المساعد"}: ${item.content}`).join("\n")}\nالطالب: ${prompt}`.trim();
    const result = await generateWithGemini({ prompt: contextualPrompt, system });
    await db.transaction(async (tx) => {
      await tx.insert(aiMessages).values({ conversationId: conversation.id, role: "user", content: prompt });
      await tx.insert(aiMessages).values({ conversationId: conversation.id, role: "assistant", content: result.text, provider: result.provider, model: result.model });
      await tx.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversation.id));
    });
    return Response.json({ conversationId: conversation.id, answer: result.text, provider: result.provider, model: result.model, disclaimer: "راجع الإجابة قبل اتخاذ قرار أكاديمي مهم." });
  } catch (error) {
    if (error instanceof GeminiError) return Response.json({ error: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
