"use client";

import { useEffect, useState } from "react";
import { ErrorBox, PageTitle } from "@/components/academic-clients";
import { SmartSummary } from "@/components/smart-summary";

type Tab = "chat" | "summary" | "audio" | "accounting";

export function AIClient({ initialTab = "chat" }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(["summary", "audio", "accounting"].includes(initialTab) ? initialTab as Tab : "chat");
  return (
    <div className="space-y-6 animate-rise pb-8">
      <PageTitle 
        title="رفيقي الذكي" 
        description="أدوات أكاديمية متصلة فعليًا بـGoogle Gemini. الإجابات تعليمية وتحتاج مراجعة، وتتطلب اتصالًا بالإنترنت." 
      />
      
      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 border-b border-app">
        {([
          ["chat", "المساعد الأكاديمي"], 
          ["summary", "ملخّصي الذكي"], 
          ["audio", "حوّل محاضرتك"], 
          ["accounting", "مساعد المحاسبة"]
        ] as [Tab, string][]).map(([id, label]) => (
          <button 
            onClick={() => setTab(id)} 
            className={`rounded-xl px-5 py-2.5 text-sm font-extrabold whitespace-nowrap transition ${tab === id ? "bg-[#085a4e] text-white" : "bg-surface text-[#085a4e] border border-app hover:bg-slate-50"}`} 
            key={id}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && <Chat type="academic" />}
      {tab === "accounting" && <Chat type="accounting" />}
      {tab === "summary" && <SmartSummary />}
      {tab === "audio" && <AudioTranscription />}
    </div>
  );
}

type Conversation = { id: string; title: string; assistantType: string; updatedAt: string };

function Chat({ type }: { type: "academic" | "accounting" }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [model, setModel] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load previous conversations list
  async function loadConversations() {
    try {
      const response = await fetch("/api/ai/chat", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        // Filter conversations matching the active tab type
        const filtered = (payload.conversations || []).filter(
          (c: Conversation) => c.assistantType === type
        );
        setConversations(filtered);
      }
    } catch {}
  }

  // Load selected conversation history
  async function loadConversationHistory(id: string) {
    setLoadingHistory(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/chat?conversationId=${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        setConversationId(payload.conversation.id);
        setMessages(payload.messages || []);
        setModel("");
      } else {
        setError(payload.error || "تعذر تحميل محادثة سابقة");
      }
    } catch {
      setError("تعذر تحميل محادثة سابقة");
    } finally {
      setLoadingHistory(false);
    }
  }

  // Reload history when type/tab changes
  useEffect(() => {
    setConversationId(undefined);
    setMessages([]);
    setError("");
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Handle starting a new fresh conversation
  function startNewConversation() {
    setConversationId(undefined);
    setMessages([]);
    setError("");
    setModel("");
  }

  async function send() {
    if (!text.trim()) return;
    const prompt = text.trim(); 
    setText(""); 
    setMessages((items) => [...items, { role: "user", content: prompt }]); 
    setBusy(true); 
    setError("");

    try {
      const response = await fetch("/api/ai/chat", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ message: prompt, conversationId, assistantType: type }) 
      });
      const payload = await response.json(); 
      if (!response.ok) throw new Error(payload.error);
      
      setConversationId(payload.conversationId); 
      setModel(`${payload.provider} — ${payload.model}`); 
      setMessages((items) => [...items, { role: "assistant", content: payload.answer }]);
      
      // Refresh list to capture the updated or newly created conversation
      loadConversations();
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : "تعذر الحصول على الإجابة"); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr] items-start animate-rise">
      {/* Sidebar: List of past conversations */}
      <aside className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <strong className="text-xs font-black text-slate-400 uppercase tracking-wider">محادثاتي السابقة</strong>
        </div>

        <button 
          onClick={startNewConversation}
          className="w-full rounded-xl border border-dashed border-[#087767]/30 bg-[#087767]/5 py-2.5 text-xs font-black text-[#087767] hover:bg-[#087767]/10 transition"
        >
          ➕ محادثة جديدة
        </button>

        <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
          {conversations.length ? (
            conversations.map((c) => {
              const active = c.id === conversationId;
              return (
                <button
                  key={c.id}
                  onClick={() => loadConversationHistory(c.id)}
                  className={`w-full rounded-xl px-3 py-2 text-right text-xs transition truncate block ${
                    active 
                      ? "bg-[#087767]/15 text-[#087767] font-extrabold" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/20"
                  }`}
                  title={c.title}
                >
                  💬 {c.title}
                </button>
              );
            })
          ) : (
            <p className="text-muted text-[10px] text-center py-4">لا توجد محادثات محفوظة بعد.</p>
          )}
        </div>
      </aside>

      {/* Main Chat Interface */}
      <section className="card overflow-hidden">
        <div className="border-b border-app p-5 bg-slate-50/50 dark:bg-slate-900/10">
          <h2 className="font-extrabold text-[#085a4e] text-lg">
            {type === "accounting" ? "تحليل قيد محاسبي ذكي" : "اسأل رفيقك الأكاديمي"}
          </h2>
          <p className="text-muted mt-1 text-xs">
            {type === "accounting" 
              ? "أدخل العملية بمبلغها وتفاصيلها، وسيحللها النموذج فعليًا." 
              : "اطرح سؤالك في المحاسبة أو الاقتصاد أو الإدارة أو الرياضيات التجارية."}
          </p>
          {model && <small className="text-muted mt-2 block" dir="ltr">{model}</small>}
        </div>

        {/* Message history */}
        <div className="min-h-96 space-y-4 p-5 max-h-[32rem] overflow-y-auto">
          {loadingHistory ? (
            <div className="space-y-4">
              <div className="skeleton h-10 w-[70%] rounded-2xl" />
              <div className="skeleton h-24 w-[85%] rounded-2xl mr-auto" />
            </div>
          ) : messages.length === 0 ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div className="max-w-md">
                <span className="text-[#087767] text-4xl block animate-bounce">✦</span>
                <strong className="mt-4 block text-slate-800 dark:text-slate-100 font-extrabold">بداية جديدة</strong>
                <p className="text-muted mt-2 text-xs leading-6">
                  {type === "accounting" 
                    ? 'اكتب العملية بمبلغها وتفاصيلها، مثل: "شراء بضاعة نقدًا بمبلغ 100000 ريال"' 
                    : "اكتب سؤالك بوضوح لتحصل على شرح مفصل، وبطاقات دراسية، وأسئلة مراجعة مخصصة."}
                </p>
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div 
                  key={index} 
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-4 text-xs leading-7 ${
                    isUser 
                      ? "mr-auto bg-[#087767] text-white font-medium" 
                      : "ml-auto bg-[var(--surface-2)] text-slate-800 dark:text-slate-100"
                  }`}
                >
                  <small className="text-[10px] block opacity-70 mb-1">
                    {isUser ? "الطالب" : "مساعد رفيقي الذكي"}
                  </small>
                  {message.content}
                </div>
              );
            })
          )}

          {busy && (
            <div className="flex items-center gap-2 text-muted text-xs bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl w-fit">
              <span className="animate-spin text-[#087767]">✦</span>
              <span>Gemini يعالج سؤالك ويولد الشرح…</span>
            </div>
          )}

          {error && <ErrorBox text={error} />}
        </div>

        {/* Input box */}
        <div className="flex gap-2 border-t border-app p-4 bg-slate-50/50 dark:bg-slate-900/10">
          <textarea 
            value={text} 
            onChange={(event) => setText(event.target.value)} 
            className="input min-h-14 text-xs" 
            placeholder="اكتب سؤالك أو القيد المحاسبي هنا…" 
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button 
            onClick={send} 
            disabled={busy || !text.trim()} 
            className="btn-primary py-2 px-5 text-xs font-black"
          >
            إرسال
          </button>
        </div>
      </section>
    </div>
  );
}

function AudioTranscription() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("ar");
  const [stage, setStage] = useState("بانتظار التسجيل");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!file) return; 
    setBusy(true); 
    setError("");
    try {
      setStage("رفع الملف"); 
      const form = new FormData(); 
      form.set("file", file);
      const upload = await fetch("/api/files", { method: "POST", body: form }); 
      const uploadData = await upload.json(); 
      if (!upload.ok) throw new Error(uploadData.error);
      
      setStage("تحويل الصوت إلى نص");
      const response = await fetch("/api/ai/transcribe", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ fileId: uploadData.file.id, language }) 
      }); 
      const payload = await response.json(); 
      if (!response.ok) throw new Error(payload.error);
      setResult(payload.transcription.transcript); 
      setStage("مراجعة النص — اكتملت المعالجة");
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : "فشلت المعالجة"); 
      setStage("فشلت العملية"); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-rise">
      <section className="card space-y-5 p-5">
        <h2 className="font-extrabold text-[#085a4e]">تسجيل وتحويل المحاضرة</h2>
        <p className="text-muted text-xs leading-5">يدعم MP3 وM4A oblivion وWAV وWebM وOGG حتى 10 MB. يلزم الاتصال بالإنترنت.</p>
        <input 
          onChange={(event) => setFile(event.target.files?.[0] || null)} 
          className="input text-xs" 
          type="file" 
          accept="audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg" 
        />
        <select value={language} onChange={(event) => setLanguage(event.target.value)} className="input text-xs">
          <option value="ar">اللغة العربية</option>
          <option value="en">اللغة الإنجليزية</option>
        </select>
        <div className="soft-card p-4">
          <span className="text-muted text-[10px] block font-bold">مرحلة المعالجة الحالية</span>
          <strong className="mt-1 block text-sm">{stage}</strong>
        </div>
        <button disabled={!file || busy} onClick={run} className="btn-primary w-full text-xs py-2.5 font-bold">
          {busy ? "جارٍ تحويل المحاضرة…" : "بدء التحويل"}
        </button>
        {error && <ErrorBox text={error} />}
      </section>
      
      <section className="card p-5 flex flex-col">
        <h2 className="font-extrabold text-[#085a4e]">النص المستخرج من التسجيل</h2>
        {result ? (
          <textarea 
            value={result} 
            onChange={(event) => setResult(event.target.value)} 
            className="input mt-4 flex-1 min-h-80 leading-7 text-xs" 
            aria-label="النص المستخرج" 
          />
        ) : (
          <div className="text-muted grid flex-1 min-h-72 place-items-center text-center text-xs leading-6">
            لا نخترع نصًا عند فشل الخدمة. سيظهر النص الحقيقي المستخرج من ملف المحاضرة هنا فقط.
          </div>
        )}
      </section>
    </div>
  );
}
