import { createHash } from "crypto";
import { readFile, stat } from "fs/promises";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { project } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "تحميل تطبيق رفيقي للأندرويد",
  description: "تنزيل النسخة التجريبية المباشرة من تطبيق رفيقي بصيغة APK.",
};

const apkUrl = "/downloads/rafeeq-beta.apk";
const apkPath = path.join(process.cwd(), "public", "downloads", "rafeeq-beta.apk");

export default async function DownloadPage() {
  let sha256 = "غير متاح";
  let size = "غير متاح";
  try {
    const [bytes, info] = await Promise.all([readFile(apkPath), stat(apkPath)]);
    sha256 = createHash("sha256").update(bytes).digest("hex");
    size = `${(info.size / 1024).toFixed(1)} KB`;
  } catch {}

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 md:py-14">
      <header className="flex items-center justify-between gap-4"><Logo /><Link href="/" className="btn-secondary">العودة</Link></header>
      <section className="card mt-10 overflow-hidden">
        <div className="brand-gradient p-7 text-white md:p-10"><span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Android Release</span><h1 className="mt-5 text-3xl font-bold md:text-5xl">حمّل رفيقي على هاتفك</h1><p className="mt-3 max-w-2xl leading-8 text-white/75">الإصدار الرسمي الحقيقي والموقّع من تطبيق رفيقي — رفيقك في طريقك الأكاديمي.</p><a href={apkUrl} download="rafeeq.apk" className="mt-7 inline-flex rounded-xl bg-white px-8 py-3.5 font-black text-black hover:bg-slate-100 transition shadow-lg text-sm">تحميل التطبيق</a></div>
        <div className="grid gap-6 p-6 md:grid-cols-2 md:p-10"><div><h2 className="text-xl font-bold">معلومات النسخة</h2><dl className="mt-4 space-y-3 text-sm"><Info label="الإصدار" value="1.0.0-release" /><Info label="الحجم" value={size} /><Info label="النظام الأدنى" value="Android 7.0" /><Info label="حالة التوقيع" value="Official Release — إصدار رسمي موقّع" /><Info label="اسم الحزمة" value="com.farouq.rafeeq" dir="ltr" /></dl></div><div><h2 className="text-xl font-bold">طريقة التثبيت</h2><ol className="text-muted mt-4 list-decimal space-y-2 pr-5 text-sm leading-7"><li>إذا كان لديك إصدار قديم بتوقيع مختلف، يرجى حذفه أولاً لتثبيت هذا الإصدار الرسمي.</li><li>اضغط على زر التحميل وانتظر اكتمال تنزيل ملف الـ APK.</li><li>افتح ملف APK من إشعارات التنزيل أو مجلد التنزيلات بجهازك.</li><li>اسمح بالتثبيت من المصادر غير المعروفة عند طلب نظام الأندرويد.</li></ol></div></div>
        <div className="border-t border-app p-5"><p className="text-muted break-all text-xs" dir="ltr">SHA-256: {sha256}</p><p className="text-muted mt-4 text-center text-xs">{project.copyright}</p></div>
      </section>
    </main>
  );
}

function Info({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return <div className="flex items-center justify-between gap-4 border-b border-app pb-2"><dt className="text-muted">{label}</dt><dd className="font-bold" dir={dir}>{value}</dd></div>;
}
