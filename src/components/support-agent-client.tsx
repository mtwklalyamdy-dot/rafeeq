"use client";

import { useEffect, useState } from "react";
import { Empty, ErrorBox, PageTitle } from "@/components/academic-clients";

type Ticket = { id: string; userId: string; userName: string; userEmail: string; assignedAgentId: string | null; type: string; subject: string; description: string; status: string; createdAt: string; updatedAt: string };
type Conversation = { id: string; ticketId: string | null; status: string };
type Message = { id: string; senderId: string; senderName: string; senderRole: string; body: string; isInternal: boolean; createdAt: string };

export function SupportAgentClient({ staffId }: { staffId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [internal, setInternal] = useState(false);

  async function load() {
    const [ticketResponse, conversationResponse] = await Promise.all([
      fetch("/api/support/tickets", { cache: "no-store" }),
      fetch("/api/support/conversations", { cache: "no-store" }),
    ]);
    const [ticketData, conversationData] = await Promise.all([ticketResponse.json(), conversationResponse.json()]);
    if (!ticketResponse.ok) throw new Error(ticketData.error || "تعذر تحميل التذاكر");
    if (!conversationResponse.ok) throw new Error(conversationData.error || "تعذر تحميل المحادثات");
    setTickets(ticketData.tickets || []);
    setConversations(conversationData.conversations || []);
  }

  async function loadMessages(conversationId: string) {
    const response = await fetch(`/api/support/conversations?id=${encodeURIComponent(conversationId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "تعذر تحميل الرسائل");
    setMessages(payload.messages || []);
  }

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر تحميل صندوق الدعم"));
    const timer = setInterval(() => load().catch(() => undefined), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeTicket) return;
    const conversation = conversations.find((item) => item.ticketId === activeTicket.id);
    if (!conversation) return;
    loadMessages(conversation.id).catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر تحميل الرسائل"));
    const timer = setInterval(() => loadMessages(conversation.id).catch(() => undefined), 8000);
    return () => clearInterval(timer);
  }, [activeTicket, conversations]);

  async function openTicket(ticket: Ticket) {
    setActiveTicket(ticket); setMessages([]); setError(""); setNotice("");
    let conversation = conversations.find((item) => item.ticketId === ticket.id);
    if (!conversation) {
      const response = await fetch("/api/support/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: ticket.id }) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "تعذر فتح المحادثة"); return; }
      conversation = payload.conversation;
      await load();
    }
    if (conversation) await loadMessages(conversation.id);
  }

  async function claimTicket(ticket: Ticket) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/support/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", ticketId: ticket.id }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذر استلام التذكرة");
      setNotice(payload.message); await load();
      const updated = { ...ticket, assignedAgentId: staffId, status: "in_progress" }; setActiveTicket(updated); await openTicket(updated);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر استلام التذكرة"); }
    finally { setBusy(false); }
  }

  async function updateStatus(ticket: Ticket, status: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/support/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", ticketId: ticket.id, status }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذر تحديث الحالة");
      setNotice(payload.message); await load();
      setActiveTicket({ ...ticket, status });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث الحالة"); }
    finally { setBusy(false); }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTicket) return;
    const conversation = conversations.find((item) => item.ticketId === activeTicket.id);
    if (!conversation) { setError("لم تُفتح محادثة للتذكرة بعد."); return; }
    const form = new FormData(event.currentTarget); const text = String(form.get("message") || "").trim(); if (!text) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/support/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: conversation.id, message: text, isInternal: internal }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذر إرسال الرسالة");
      event.currentTarget.reset(); setInternal(false); await loadMessages(conversation.id); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إرسال الرسالة"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6 animate-rise pb-8">
    <PageTitle title="صندوق موظف الدعم" description="التذاكر محفوظة في قاعدة البيانات. تتحدث القائمة كل 15 ثانية والرسائل كل 8 ثوانٍ (تحديث دوري وليس WebSocket)." />
    {error && <ErrorBox text={error} />}
    {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <section className="space-y-3"><h2 className="text-lg font-extrabold">طلبات الدعم ({tickets.length})</h2>
        {tickets.length ? tickets.map((ticket) => <article key={ticket.id} className={`card p-4 ${activeTicket?.id === ticket.id ? "ring-2 ring-[var(--brand)]" : ""}`}>
          <button className="w-full text-right" onClick={() => openTicket(ticket)}><div className="flex items-start justify-between gap-2"><div><span className="badge">{statusLabel(ticket.status)}</span><strong className="mt-2 block text-sm">{ticket.subject}</strong></div><span className="text-muted text-[10px]">{new Date(ticket.updatedAt).toLocaleDateString("ar-YE")}</span></div><span className="text-muted mt-2 block text-xs">{ticket.userName} · <bdi dir="ltr">{ticket.userEmail}</bdi></span><p className="text-muted mt-2 line-clamp-2 text-xs">{ticket.description}</p></button>
          <div className="mt-3 flex flex-wrap items-center gap-2">{ticket.assignedAgentId === staffId ? <span className="badge">مسندة إليك</span> : ticket.assignedAgentId ? <span className="badge">مسندة لموظف آخر</span> : <button disabled={busy} onClick={() => claimTicket(ticket)} className="btn-primary !px-3 !py-2 text-xs">استلام الطلب</button>}
            {ticket.assignedAgentId === staffId && <select className="input !w-auto text-xs" value={ticket.status} disabled={busy} onChange={(event) => updateStatus(ticket, event.target.value)}><option value="in_progress">قيد المعالجة</option><option value="waiting">بانتظار رد الطالب</option><option value="resolved">تم الحل</option><option value="closed">مغلقة</option></select>}
          </div>
        </article>) : <Empty text="لا توجد تذاكر دعم في قاعدة البيانات حاليًا. ستظهر هنا الطلبات الحقيقية عند إنشائها من حساب طالب." />}
      </section>

      <section className="card flex min-h-[34rem] flex-col overflow-hidden"><div className="border-b border-app p-4"><h2 className="font-extrabold">{activeTicket ? activeTicket.subject : "محادثة الدعم"}</h2><p className="text-muted mt-1 text-xs">{activeTicket ? `الطالب: ${activeTicket.userName} · ${statusLabel(activeTicket.status)}` : "اختر تذكرة لعرض بياناتها والرد على الطالب."}</p></div>
        {activeTicket ? <><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length ? messages.map((item) => <div key={item.id} className={`max-w-[88%] rounded-xl p-3 text-sm ${item.isInternal ? "border border-amber-300 bg-amber-50 text-amber-950" : item.senderRole === "support" || item.senderRole === "admin" ? "ml-auto bg-[var(--surface-2)]" : "mr-auto bg-[var(--brand)] text-white"}`}><small className="block text-[10px] opacity-70">{item.isInternal ? "ملاحظة داخلية" : `${item.senderName} · ${item.senderRole === "support" || item.senderRole === "admin" ? "الدعم" : "الطالب"}`} · {new Date(item.createdAt).toLocaleString("ar-YE")}</small><p className="mt-2 whitespace-pre-wrap leading-6">{item.body}</p></div>) : <p className="text-muted py-10 text-center text-sm">لا توجد رسائل في المحادثة بعد.</p>}</div>{activeTicket.assignedAgentId === staffId && <form onSubmit={send} className="space-y-2 border-t border-app p-4"><textarea className="input min-h-20 text-sm" name="message" placeholder="اكتب ردًا للطالب…" required /><label className="text-muted flex items-center gap-2 text-xs"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> ملاحظة داخلية لا تظهر للطالب</label><button disabled={busy} className="btn-primary w-full">{busy ? "جارٍ الإرسال…" : "إرسال الرسالة"}</button></form>}</> : <div className="text-muted grid flex-1 place-items-center p-8 text-center text-sm">اختر تذكرة دعم لعرض المحادثة.</div>}
      </section>
    </div>
  </div>;
}

function statusLabel(status: string) { return ({ open: "مفتوحة", waiting: "بانتظار الطالب", in_progress: "قيد المعالجة", resolved: "تم الحل", closed: "مغلقة" } as Record<string, string>)[status] || status; }
