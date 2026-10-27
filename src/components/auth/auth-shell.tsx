import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeButton } from "@/components/theme-provider";
import { project } from "@/lib/utils";

export function AuthShell({ children, eyebrow = "منصتك الأكاديمية" }: { children: ReactNode; eyebrow?: string }) {
  return <main className="auth-grid">
    <section className="auth-form-wrap relative">
      <div className="absolute left-5 top-5"><ThemeButton /></div>
      <div className="w-full max-w-md animate-rise">{children}<p className="text-muted mt-8 text-center text-xs">{project.copyright}</p></div>
    </section>
    <section className="auth-visual">
      <div className="relative z-10"><Logo inverse /><span className="mt-10 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm">{eyebrow}</span><h1 className="mt-5 max-w-xl text-4xl font-bold leading-[1.35] lg:text-6xl">كل ما تحتاجه في رحلتك الجامعية، في مكان واحد.</h1><p className="mt-5 max-w-xl text-lg leading-8 text-white/75">موادك وواجباتك وملخصاتك ومجتمعك الدراسي، مصممة لاتصال محدود وتجربة عربية واضحة.</p></div>
      <div className="feature-list relative z-10 grid max-w-2xl grid-cols-2 gap-3 text-sm"><span className="rounded-2xl bg-white/10 p-4">✓ محتوى محفوظ دون إنترنت</span><span className="rounded-2xl bg-white/10 p-4">✓ بيانات وصلاحيات حقيقية</span><span className="rounded-2xl bg-white/10 p-4">✓ مجتمع أكاديمي منظم</span><span className="rounded-2xl bg-white/10 p-4">✓ أدوات ذكية عند تفعيلها</span></div>
      <Link href="/about" className="relative z-10 text-sm text-white/65 hover:text-white">عن رفيقي وخصوصية البيانات</Link>
    </section>
  </main>;
}
