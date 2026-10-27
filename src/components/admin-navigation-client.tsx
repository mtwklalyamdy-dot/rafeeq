"use client";

import { useEffect, useState } from "react";
import { Empty, ErrorBox } from "@/components/academic-clients";

type MenuItem = { id: string; href: string; label: string; icon: string; category: string; roles: string[]; order: number; enabled: boolean };
type FeatureFlags = Record<string, boolean>;
const featureOptions: Array<[string, string]> = [["ai", "المساعد الذكي"], ["community", "مجتمع رفيقي"], ["academicContent", "المواد والمحتوى الأكاديمي"], ["offline", "المكتبة دون اتصال"], ["tools", "الأدوات"], ["support", "الدعم"], ["telegram", "قنوات Telegram"], ["dictionary", "قاموس المصطلحات"]];
const defaultFlags: FeatureFlags = Object.fromEntries(featureOptions.map(([key]) => [key, true]));
const routes = [
  ["/dashboard", "الرئيسية"], ["/courses", "المواد الدراسية"], ["/library", "المكتبة الرقمية"],
  ["/assignments", "الواجبات"], ["/exams", "الاختبارات"], ["/grades", "الدرجات"],
  ["/calendar", "الجدول والتقويم"], ["/notes", "الملاحظات"], ["/offline", "المكتبة دون إنترنت"],
  ["/community", "مجتمع رفيقي"], ["/ai", "المساعد الذكي"], ["/support", "الدعم"],
  ["/tools", "الأدوات"], ["/dictionary", "قاموس المصطلحات"], ["/telegram", "قنوات الملخصات"],
  ["/settings", "الإعدادات"], ["/about", "حول التطبيق"], ["/download", "تحميل التطبيق"],
] as const;
const categories = ["الدراسة", "التنظيم", "الذكاء الاصطناعي", "مجتمع رفيقي", "أدوات ومصادر", "الدعم والإعدادات"];
const roles = [["student", "طالب"], ["representative", "مندوب"], ["support", "دعم"], ["admin", "مدير"]] as const;

export function AdminNavigationClient() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(defaultFlags);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [href, setHref] = useState<string>("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>(categories[0]);
  const [icon, setIcon] = useState("•");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["student", "representative", "support", "admin"]);

  async function load() {
    const response = await fetch("/api/app-config", { cache: "no-store" }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "تعذر تحميل إعدادات القائمة");
    setItems(Array.isArray(payload.menu) ? payload.menu : []);
    setFeatureFlags({ ...defaultFlags, ...(payload.featureFlags || {}) });
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  async function save(next: MenuItem[]) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "menu.save", items: next }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذر حفظ القائمة");
      setItems(payload.result.items); setMessage("تم حفظ القائمة في إعدادات التطبيق. ستظهر بعد تحديث التطبيق."); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ القائمة"); return false; }
    finally { setBusy(false); }
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const routeLabel = routes.find(([path]) => path === href)?.[1] || "";
    const nextItem: MenuItem = { id: crypto.randomUUID(), href, label: label.trim() || routeLabel, category, icon: icon.trim() || "•", roles: selectedRoles, order: items.length, enabled: true };
    if (!href || !selectedRoles.length) { setError("اختر مسارًا وأدوارًا مسموحًا بها."); return; }
    const done = await save([...items, nextItem]); if (done) { setHref(""); setLabel(""); setIcon("•"); }
  }

  function toggleRole(role: string) { setSelectedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]); }

  async function toggleFeature(key: string, enabled: boolean) {
    setBusy(true); setError(""); setMessage("");
    const nextFlags = { ...featureFlags, [key]: enabled };
    try {
      const response = await fetch("/api/admin/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "feature_flags.save", flags: { [key]: enabled } }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذر حفظ إعداد الميزة");
      setFeatureFlags({ ...defaultFlags, ...(payload.result.flags || nextFlags) });
      setMessage("حُفظ إعداد ظهور الميزة في القائمة. الصلاحيات الخادمية تبقى مطبقة بشكل مستقل.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ إعداد الميزة"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    {error && <ErrorBox text={error} />}
    {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p>}
    <form onSubmit={add} className="card grid gap-4 p-5">
      <div><h2 className="text-lg font-extrabold">إضافة خيار للقائمة الرئيسية</h2><p className="text-muted mt-1 text-xs">المسارات محصورة في صفحات موجودة في التطبيق؛ إضافة خيار لا تنشئ وظيفة غير موجودة.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label><span className="label">الصفحة/المسار</span><select className="input" value={href} onChange={(event) => setHref(event.target.value)} required><option value="">اختر صفحة موجودة</option>{routes.map(([path, name]) => <option value={path} key={path}>{name} — {path}</option>)}</select></label>
        <label><span className="label">عنوان الخيار (اختياري)</span><input className="input" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} placeholder="يستخدم اسم الصفحة افتراضيًا" /></label>
        <label><span className="label">القسم</span><select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="label">أيقونة نصية بسيطة</span><input className="input" value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={12} /></label>
      </div>
      <fieldset className="flex flex-wrap gap-3"><legend className="label">الأدوار المسموح لها برؤية الخيار</legend>{roles.map(([value, title]) => <label key={value} className="soft-card flex items-center gap-2 px-3 py-2 text-sm"><input type="checkbox" checked={selectedRoles.includes(value)} onChange={() => toggleRole(value)} />{title}</label>)}</fieldset>
      <button disabled={busy} className="btn-primary">إضافة وحفظ</button>
    </form>

    <section className="card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">الخيارات الإضافية الحالية</h2><span className="badge">{items.length}</span></div>
      {items.length ? <div className="mt-4 space-y-3">{items.map((item) => <article key={item.id} className="soft-card flex flex-wrap items-center gap-3 p-3"><span className="text-xl">{item.icon}</span><div className="min-w-0 flex-1"><strong className="block text-sm">{item.label}</strong><small className="text-muted" dir="ltr">{item.href}</small><small className="text-muted block">{item.category} · {item.roles.join("، ")}</small></div><button disabled={busy} onClick={() => save(items.map((entry) => entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry))} className="btn-secondary text-xs">{item.enabled ? "إخفاء" : "إظهار"}</button><button disabled={busy} onClick={() => { if (confirm(`حذف خيار القائمة «${item.label}»؟ لن تُحذف الصفحة أو بياناتها.`)) save(items.filter((entry) => entry.id !== item.id)); }} className="btn-secondary text-xs text-red-600">إزالة من القائمة</button></article>)}</div> : <Empty text="لا توجد خيارات مضافة من لوحة الإدارة. عناصر القائمة الأصلية باقية كما هي." />}
    </section>

    <section className="card p-5"><h2 className="text-lg font-extrabold">إظهار الأدوات والميزات</h2><p className="text-muted mt-1 text-xs">هذا الخيار يتحكم بإظهار الرابط في القائمة فقط؛ صلاحيات API والتحقق من الهوية لا تتغير.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{featureOptions.map(([key, title]) => <label key={key} className="soft-card flex items-center justify-between gap-3 p-3 text-sm"><span>{title}</span><input type="checkbox" disabled={busy} checked={featureFlags[key] ?? true} onChange={(event) => toggleFeature(key, event.target.checked)} /></label>)}</div></section>
  </div>;
}
