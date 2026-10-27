/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { ErrorBox, PageTitle } from "@/components/academic-clients";
import { project } from "@/lib/utils";

type Ticket = { id: string; subject: string; description: string; status: string; type: string; createdAt: string; updatedAt: string };
type Conversation = { id: string; ticketId: string | null; status: string };
type Message = { id: string; senderId: string; senderName: string; senderRole: string; body: string; isInternal: boolean; createdAt: string };

export function SupportClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [ticketResponse, conversationResponse] = await Promise.all([
      fetch("/api/support/tickets", { cache: "no-store" }),
      fetch("/api/support/conversations", { cache: "no-store" })
    ]);
    const ticketData = await ticketResponse.json();
    const conversationData = await conversationResponse.json();
    if (!ticketResponse.ok) throw new Error(ticketData.error);
    if (!conversationResponse.ok) throw new Error(conversationData.error);
    setTickets(ticketData.tickets);
    setConversations(conversationData.conversations);
  }

  async function loadMessages(id: string) {
    const response = await fetch(`/api/support/conversations?id=${id}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setMessages(data.messages); setCurrentUserId(data.currentUserId || ""); }
    else setError(data.error);
  }

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);
  useEffect(() => { if (!active) return; loadMessages(active); const timer = setInterval(() => loadMessages(active), 8000); return () => clearInterval(timer); }, [active]);

  async function openConversation(ticketId: string) {
    setError("");
    let conversation = conversations.find((item) => item.ticketId === ticketId);
    if (!conversation) {
      const response = await fetch("/api/support/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      conversation = data.conversation;
      await load();
    }
    setActive(conversation!.id);
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(data.error); return; }
    event.currentTarget.reset();
    setOpenForm(false);
    await load();
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/support/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: active, message: form.get("message") }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(data.error); return; }
    event.currentTarget.reset();
    await loadMessages(active);
    await load();
  }

  return (
    <div className="space-y-6 animate-rise pb-8">
      {/* Title & subtitle matching Image 3 */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#085a4e]">الرسائل الخاصة</h1>
        <p className="text-muted text-sm mt-1">
          محادثاتك مع زملائك الطلاب (يتم تحديث الرسائل كل بضع ثوانٍ وليس فورياً بالكامل)
        </p>
      </div>

      {error && <ErrorBox text={error} />}

      {/* Primary support options */}
      <div className="grid gap-4 md:grid-cols-2">
        <a className="card flex items-center gap-4 p-5 hover:scale-[1.01] transition" href={project.whatsappUrl} target="_blank" rel="noreferrer">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-2xl text-emerald-800">
            💬
          </span>
          <span>
            <strong className="block text-slate-800 dark:text-slate-100">تواصل عبر WhatsApp</strong>
            <small className="text-muted mt-1 block" dir="ltr">{project.whatsapp}</small>
            <small className="text-muted block text-xs">يفتح المحادثة ولا يرسل تلقائيًا</small>
          </span>
        </a>
        <a className="card flex items-center gap-4 p-5 hover:scale-[1.01] transition" href={project.mailtoUrl}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-2xl text-amber-800">
            ✉
          </span>
          <span>
            <strong className="block text-slate-800 dark:text-slate-100 font-bold">راسل الدعم عبر البريد</strong>
            <small className="text-muted mt-1 block" dir="ltr">{project.email}</small>
            <small className="text-muted block text-xs">يفتح تطبيق البريد ولا يرسل تلقائيًا</small>
          </span>
        </a>
      </div>

      <div className="flex justify-end pt-2">
        <button 
          onClick={() => setOpenForm(!openForm)} 
          className="rounded-xl bg-[#085a4e] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#05433a] transition shadow-md"
        >
          {openForm ? "إلغاء الطلب" : "+ إنشاء تذكرة جديدة"}
        </button>
      </div>

      {openForm && (
        <form onSubmit={createTicket} className="card grid gap-4 p-5 animate-rise">
          <h2 className="font-bold text-lg">طلب دعم جديد</h2>
          <select name="type" className="input" required>
            <option value="technical">مشكلة تقنية</option>
            <option value="account">الحساب</option>
            <option value="content">المحتوى الأكاديمي</option>
            <option value="other">أخرى</option>
          </select>
          <input name="subject" className="input" placeholder="عنوان المشكلة" required />
          <textarea name="description" className="input min-h-28" placeholder="اشرح المشكلة بالتفصيل" required />
          <button disabled={busy} className="btn-primary">إنشاء التذكرة</button>
        </form>
      )}

      {/* Ticket conversations list */}
      <section className="space-y-4">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">تذاكري ومحادثاتي الدراسية</h2>
        
        {tickets.length ? (
          <div className="space-y-4">
            {tickets.map((ticket) => {
              const conversation = conversations.find((item) => item.ticketId === ticket.id);
              const isOpen = active === conversation?.id;
              return (
                <article className="card p-5 animate-rise" key={ticket.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="badge">{statusLabel(ticket.status)}</span>
                      <h3 className="mt-3 font-extrabold text-slate-800 dark:text-slate-100">{ticket.subject}</h3>
                      <p className="text-muted mt-2 text-xs leading-6">{ticket.description}</p>
                    </div>
                    <time className="text-muted text-[10px]">{new Date(ticket.updatedAt).toLocaleString("ar-YE")}</time>
                  </div>
                  <button 
                    onClick={() => isOpen ? setActive(null) : openConversation(ticket.id)} 
                    className="btn-secondary mt-4 text-xs font-bold"
                  >
                    {isOpen ? "إغلاق المحادثة" : conversation ? "فتح المحادثة" : "بدء محادثة حول التذكرة"}
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-3 border-t border-app pt-4 animate-rise">
                      {messages.length ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto p-1">
                          {messages.map((message) => {
                            const isMe = message.senderId === currentUserId;
                            return (
                              <div 
                                className={`rounded-xl p-3 text-xs max-w-[85%] ${
                                  isMe 
                                    ? "mr-auto bg-[#087767] text-white" 
                                    : "ml-auto bg-[var(--surface-2)] text-slate-800 dark:text-slate-100"
                                }`} 
                                key={message.id}
                              >
                                <small className="text-[10px] block opacity-70 mb-1">
                                  {isMe ? "أنت" : message.senderName || "الدعم الفني"} · {new Date(message.createdAt).toLocaleString("ar-YE")}
                                </small>
                                <p className="whitespace-pre-wrap leading-5">{message.body}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-muted text-xs">لا توجد رسائل بعد.</p>
                      )}

                      <form onSubmit={send} className="flex gap-2">
                        <input name="message" className="input text-xs" placeholder="اكتب رسالتك للدعم الفني…" required />
                        <button disabled={busy} className="btn-primary text-xs py-2">إرسال</button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          /* Beautiful empty container matching Image 3 perfectly */
          <div className="card flex flex-col items-center justify-center p-12 text-center shadow-xs">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-[#087767] text-3xl dark:bg-emerald-950/20">
              💬
            </span>
            <strong className="mt-5 block text-lg font-extrabold text-slate-800 dark:text-slate-100">لا توجد محادثات بعد</strong>
            <p className="text-muted mt-2 text-xs max-w-sm leading-6">
              ابدأ محادثة من الملف الشخصي لأي طالب.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function statusLabel(value: string) {
  return ({
    open: "مفتوحة",
    waiting: "وصل رد/بانتظارك",
    in_progress: "قيد المعالجة",
    resolved: "تم الحل",
    closed: "مغلقة",
  } as Record<string, string>)[value] || value;
}
