"use client";

import { useEffect, useState } from "react";
import { Empty, ErrorBox } from "@/components/academic-clients";

type Manager = { id: string; fullName: string; email: string; isActive: boolean; emailVerifiedAt: string | null; protectedByEnvironment: boolean };
type SupportStaff = { id: string; fullName: string; email: string; isActive: boolean; isAvailable: boolean; lastSeenAt: string | null };

export function AdminAccessClient({ busy, action }: { busy: boolean; action: (body: Record<string, unknown>, success?: string) => Promise<unknown> }) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [supportStaff, setSupportStaff] = useState<SupportStaff[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/managers", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل المديرين وموظفي الدعم");
      setManagers(payload.managers || []);
      setSupportStaff(payload.supportStaff || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات الصلاحيات");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function grant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!confirm(`منح صلاحيات المدير للحساب ${normalizedEmail}؟ يشترط وجود حساب نشط وموثّق.`)) return;
    const response = await fetch("/api/admin/managers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "تعذر منح الصلاحية"); return; }
    setMessage(payload.message); setEmail(""); await load();
  }

  async function revoke(manager: Manager) {
    setError(""); setMessage("");
    if (manager.protectedByEnvironment) { setError("هذا الحساب محمي بإعداد خادمي؛ أزله من إعداد المضيف بعد التأكد من وجود مدير آخر."); return; }
    if (!confirm(`سحب صلاحيات المدير من ${manager.fullName} (${manager.email})؟ سيُستعاد دوره السابق وتُنهى جلساته.`)) return;
    const response = await fetch("/api/admin/managers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: manager.id }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "تعذر سحب الصلاحية"); return; }
    setMessage(payload.message); await load();
  }

  async function setManagerActive(manager: Manager, isActive: boolean) {
    if (!confirm(`${isActive ? "تفعيل" : "تعطيل"} حساب المدير ${manager.email}؟`)) return;
    const response = await fetch("/api/admin/managers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: manager.id, isActive }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "تعذر تعديل حالة المدير");
    else { setMessage(payload.message); await load(); }
  }

  async function setAvailable(staff: SupportStaff, isAvailable: boolean) {
    await action({ action: "supportAgent.availability", userId: staff.id, isAvailable }, isAvailable ? "تم تعيين الموظف متاحًا لاستقبال الطلبات." : "تم تعيين الموظف غير متاح لاستقبال الطلبات.");
    await load();
  }

  if (loading) return <div className="skeleton h-72" />;

  return <div className="space-y-7 animate-rise">
    {error && <ErrorBox text={error} />}
    {message && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div>}

    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-[#085a4e]">المديرون</h2><p className="text-muted mt-1 text-xs">تُمنح الصلاحية لحساب موجود ونشط وموثّق؛ لا يُنشأ حساب ولا تتغير كلمة المرور.</p></div><span className="badge">{managers.length} مدير</span></div>
      <form onSubmit={grant} className="mt-5 flex flex-wrap gap-2"><input className="input min-w-56 flex-1 text-sm" type="email" inputMode="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="بريد حساب موجود وموثّق" required /><button disabled={busy || !email.trim()} className="btn-primary">+ منح صلاحية المدير</button></form>
      <div className="mt-5 space-y-3">{managers.length ? managers.map((manager) => <article className="soft-card flex flex-wrap items-center gap-3 p-4" key={manager.id}><span className={`h-3 w-3 rounded-full ${manager.isActive ? "bg-emerald-500" : "bg-red-500"}`} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{manager.fullName}</strong><small className="text-muted" dir="ltr">{manager.email}</small><div className="mt-1 flex gap-2"><span className="badge">{manager.isActive ? "نشط" : "معطل"}</span>{manager.protectedByEnvironment && <span className="badge">محمي بإعداد الخادم</span>}</div></div><button disabled={busy || manager.protectedByEnvironment} onClick={() => setManagerActive(manager, !manager.isActive)} className="btn-secondary text-xs">{manager.isActive ? "تعطيل" : "تفعيل"}</button><button disabled={busy || manager.protectedByEnvironment} onClick={() => revoke(manager)} className="btn-secondary text-xs text-red-600">سحب الدور</button></article>) : <Empty text="لا يوجد مديرون مسجلون." />}</div>
    </section>

    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-[#085a4e]">موظفو الدعم</h2><p className="text-muted mt-1 text-xs">التوفر هنا إعداد يدوي، وليس مؤشر اتصال حي.</p></div><span className="badge">{supportStaff.length} موظف</span></div>
      <div className="mt-5 space-y-3">{supportStaff.length ? supportStaff.map((staff) => <article className="soft-card flex flex-wrap items-center gap-3 p-4" key={staff.id}><span className={`h-3 w-3 rounded-full ${staff.isActive ? "bg-emerald-500" : "bg-red-500"}`} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{staff.fullName}</strong><small className="text-muted" dir="ltr">{staff.email}</small><span className="badge mt-1">{staff.isAvailable ? "مُتاح لاستقبال الحالات" : "غير متاح حسب الإعداد"}</span></div><button disabled={busy || !staff.isActive} onClick={() => setAvailable(staff, !staff.isAvailable)} className="btn-secondary text-xs">{staff.isAvailable ? "تعيين غير متاح" : "تعيين متاح"}</button></article>) : <Empty text="لا توجد حسابات بدور موظف دعم." />}</div>
    </section>
  </div>;
}
