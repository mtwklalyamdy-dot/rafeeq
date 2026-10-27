"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";

export function LoginForm({ representative = false }: { representative?: boolean }) {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), portal: representative ? "representative" : "student" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      router.push(data.role === "representative" ? "/representative/dashboard" : data.role === "admin" ? "/admin" : data.role === "support" ? "/support" : "/dashboard"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تسجيل الدخول"); } finally { setLoading(false); }
  }
  return <><Logo /><div className="mt-9"><p className="text-brand text-sm font-bold">{representative ? "بوابة المندوب الطلابي" : "مرحبًا بعودتك"}</p><h2 className="mt-2 text-3xl font-bold">تسجيل الدخول</h2><p className="text-muted mt-2 text-sm">استخدم بريدك الموثق للوصول إلى حسابك.</p></div>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    <form onSubmit={submit} className="mt-7 space-y-5"><label><span className="label">البريد الإلكتروني</span><input className="input" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="name@example.com" dir="ltr" /></label><label><span className="label">كلمة المرور</span><input className="input" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" dir="ltr" /></label><div className="flex items-center justify-between text-sm"><Link className="text-brand font-bold" href="/forgot-password">نسيت كلمة المرور؟</Link><Link className="text-muted" href={representative ? "/" : "/representative/login"}>{representative ? "دخول الطالب" : "دخول المندوب"}</Link></div><button disabled={loading} className="btn-primary w-full" type="submit">{loading ? "جارٍ التحقق…" : "تسجيل الدخول ←"}</button></form>
    <p className="text-muted mt-6 text-center text-sm">ليس لديك حساب؟ <Link className="text-brand font-bold" href={`/register${representative ? "?type=representative" : ""}`}>إنشاء حساب جديد</Link></p>
    <Link href="/download" className="btn-secondary mt-4 w-full">تحميل تطبيق Android ↓</Link></>;
}
