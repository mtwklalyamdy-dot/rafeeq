"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Dashboard = {
  user: { fullName: string; university: string | null };
  courses: Array<{ id: string; name: string; code: string }>;
  assignments: Array<{ id: string; title: string; dueAt: string; courseName: string }>;
  content: Array<{ id: string; title: string; kind: string; courseName: string; updatedAt: string }>;
  announcements: Array<{ id: string; title: string; body: string }>;
  schedule: Array<{ id: string; startsAt: string; endsAt: string; room: string | null; courseName: string }>;
  unreadNotifications: number;
  studyPlan: { title: string; progress: number } | null;
  serverTime: string;
};

export function DashboardClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error);
        return r.json();
      })
      .then((d) => {
        setData(d);
        localStorage.setItem("rafeeq-dashboard-snapshot", JSON.stringify(d));
      })
      .catch((e) => {
        setError(e.message);
        try {
          const saved = localStorage.getItem("rafeeq-dashboard-snapshot");
          if (saved) {
            setData(JSON.parse(saved));
            setStale(true);
          }
        } catch {}
      });
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-48 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Fallback values matching image
  const fullName = data.user.fullName || "فاروق مقبول داوود سعد";
  const university = data.user.university || "جامعة الحديدة";
  const progressPercent = data.studyPlan?.progress ?? 0;

  return (
    <div className="space-y-6 animate-rise pb-8">
      {stale && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          تعرض هذه الصفحة نسخة محفوظة بتاريخ {new Date(data.serverTime).toLocaleString("ar-YE")} وقد لا تكون الأحدث.
        </div>
      )}

      {/* Header Teal Block */}
      <section className="relative overflow-hidden rounded-[1.7rem] bg-[#085a4e] text-white p-6 md:p-8 text-center md:text-right shadow-[0_15px_30px_rgba(8,90,78,0.15)]">
        <div className="relative z-10 flex flex-col items-center justify-center py-4">
          <span className="text-xs text-emerald-200/80 font-bold uppercase tracking-wider">أهلاً بك</span>
          <h1 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">{fullName}</h1>
          <p className="mt-1 text-sm text-emerald-100/70">{university}</p>
          
          <Link 
            href="/ai" 
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-extrabold text-[#085a4e] hover:bg-emerald-50 transition shadow-md"
          >
            <span>✨ اسأل المساعد الذكي</span>
          </Link>
        </div>
        {/* Decorative circle */}
        <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full border-[20px] border-white/5 opacity-40" />
      </section>

      {/* Stat Cards - Grid of 2x2 */}
      <section className="grid grid-cols-2 gap-4">
        {/* Card 1: Current Courses */}
        <Link href="/courses" className="card flex flex-col items-center justify-center p-5 text-center hover:scale-[1.02] transition duration-200">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.967 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.967 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.967 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </span>
          <strong className="mt-4 text-3xl font-black text-slate-800 dark:text-slate-100">{data.courses.length}</strong>
          <span className="text-xs text-muted font-bold mt-1">المواد الحالية</span>
        </Link>

        {/* Card 2: Upcoming Assignments */}
        <Link href="/assignments" className="card flex flex-col items-center justify-center p-5 text-center hover:scale-[1.02] transition duration-200">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
            </svg>
          </span>
          <strong className="mt-4 text-3xl font-black text-slate-800 dark:text-slate-100">{data.assignments.length}</strong>
          <span className="text-xs text-muted font-bold mt-1">واجبات قادمة</span>
        </Link>

        {/* Card 3: Available Exams */}
        <Link href="/exams" className="card flex flex-col items-center justify-center p-5 text-center hover:scale-[1.02] transition duration-200">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </span>
          <strong className="mt-4 text-3xl font-black text-slate-800 dark:text-slate-100">{data.schedule.length}</strong>
          <span className="text-xs text-muted font-bold mt-1">اختبارات متاحة</span>
        </Link>

        {/* Card 4: Study Progress */}
        <Link href="/settings" className="card flex flex-col items-center justify-center p-5 text-center hover:scale-[1.02] transition duration-200">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
          </span>
          <strong className="mt-4 text-3xl font-black text-slate-800 dark:text-slate-100">{progressPercent}%</strong>
          <span className="text-xs text-muted font-bold mt-1">نسبة الإنجاز</span>
        </Link>
      </section>

      {/* Quick Access Grid - 2x2 */}
      <section className="space-y-4">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">الوصول السريع</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Quick Action 1: Community */}
          <Link href="/community" className="card flex items-center gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A2.25 2.25 0 0 1 12.75 21.5h-1.5a2.25 2.25 0 0 1-2.25-2.263V19.13m4.5 0c-.146-.369-.362-.706-.64-1a9.967 9.967 0 0 0-6.108-3.072 4.125 4.125 0 0 0-7.533 2.493 9.354 9.354 0 0 0 4.119.953 9.38 9.38 0 0 0 2.625-.372M9.75 8.25a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM18.75 8.25a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </span>
            <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">مجتمع رفيقي</span>
          </Link>

          {/* Quick Action 2: Summary */}
          <Link href="/ai?tab=summary" className="card flex items-center gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </span>
            <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">تلخيص ذكي</span>
          </Link>

          {/* Quick Action 3: Telegram */}
          <Link href="/telegram" className="card flex items-center gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </span>
            <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">قنوات تيليجرام</span>
          </Link>

          {/* Quick Action 4: Messages */}
          <Link href="/support" className="card flex items-center gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379L12 21l3.12-2.883c1.152-.086 2.294-.213 3.42-.379 1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.028Z" />
              </svg>
            </span>
            <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">الرسائل</span>
          </Link>
        </div>
      </section>

      {/* Main Content Details (Remaining items visible underneath) */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr] pt-4">
        {/* Current calendar schedule */}
        {data.schedule.length > 0 && (
          <section className="card p-5">
            <h2 className="text-base font-extrabold mb-3">جدول اليوم الدراسي</h2>
            <div className="space-y-3">
              {data.schedule.map((s) => (
                <div key={s.id} className="flex gap-3 border-b border-app pb-3 last:border-0 last:pb-0">
                  <time className="text-brand font-bold text-xs" dir="ltr">{s.startsAt}</time>
                  <div>
                    <strong className="text-sm block">{s.courseName}</strong>
                    <p className="text-muted text-xs">{s.room || "القاعة غير محددة"} · حتى {s.endsAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Latest Announcements */}
        {data.announcements.length > 0 && (
          <section className="card p-5">
            <h2 className="text-base font-extrabold mb-3">آخر الإعلانات الأكاديمية</h2>
            <div className="space-y-3">
              {data.announcements.map((a) => (
                <article key={a.id} className="border-b border-app pb-3 last:border-0 last:pb-0">
                  <strong className="text-sm block">{a.title}</strong>
                  <p className="text-muted mt-1 line-clamp-2 text-xs leading-5">{a.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
