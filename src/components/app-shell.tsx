"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState, useEffect } from "react";
import { ConnectionBadge, ThemeButton } from "@/components/theme-provider";

type UserType = {
  fullName: string;
  email: string;
  role: string;
  university?: string | null;
};
type AdminMenuItem = { id: string; href: string; label: string; icon: string; category: string; roles: string[]; order: number; enabled: boolean };
type FeatureFlags = Record<string, boolean>;
const routeFeature: Record<string, string> = { "/ai": "ai", "/community": "community", "/courses": "academicContent", "/library": "academicContent", "/assignments": "academicContent", "/exams": "academicContent", "/grades": "academicContent", "/offline": "offline", "/tools": "tools", "/support": "support", "/telegram": "telegram", "/dictionary": "dictionary" };

export function AppShell({ children, user }: { children: ReactNode; user: UserType }) {
  const path = usePathname();
  const router = useRouter();
  
  // Navigation drawer toggle state
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // User profile dropdown toggle state
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminMenuItems, setAdminMenuItems] = useState<AdminMenuItem[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/app-config", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (Array.isArray(payload?.menu)) setAdminMenuItems(payload.menu);
        if (payload?.featureFlags && typeof payload.featureFlags === "object") setFeatureFlags(payload.featureFlags);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  // Handle clicking outside profile dropdown to close it
  useEffect(() => {
    if (!profileOpen) return;
    const handle = () => setProfileOpen(false);
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [profileOpen]);

  // First initial of user's name
  const initial = user.fullName ? user.fullName.trim().charAt(0) : "ف";

  // Sidebar categorized links matching Image 4 & 5
  const navCategories = [
    {
      title: "الدراسة",
      links: [
        { href: "/courses", label: "المواد الدراسية", icon: "📖" },
        { href: "/library", label: "الملخصات والمحاضرات", icon: "📄" },
        { href: "/assignments", label: "الواجبات", icon: "📋" },
        { href: "/exams", label: "الاختبارات", icon: "📝" },
        { href: "/grades", label: "الدرجات والمعدل", icon: "🎓" },
      ]
    },
    {
      title: "التنظيم",
      links: [
        { href: "/calendar", label: "الجدول الدراسي", icon: "📅" },
        { href: "/calendar", label: "التقويم الأكاديمي", icon: "⏰" },
        { href: "/notes", label: "ملاحظاتي", icon: "📄" },
        { href: "/library", label: "المكتبة الرقمية", icon: "📚" },
      ]
    },
    {
      title: "الذكاء الاصطناعي",
      links: [
        { href: "/ai", label: "المساعد الأكاديمي", icon: "✨" },
        { href: "/ai?tab=accounting", label: "مساعد المحاسبة", icon: "🧮" },
        { href: "/ai?tab=summary", label: "تلخيص الملفات", icon: "📄" },
        { href: "/ai", label: "توليد اختبار تدريبي", icon: "📝" },
        { href: "/dashboard", label: "خطة المذاكرة", icon: "📅" },
      ]
    },
    {
      title: "مجتمع رفيقي",
      links: [
        { href: "/community", label: "الأسئلة والمنشورات", icon: "👥" },
        { href: "/community", label: "الأسئلة الأكاديمية", icon: "❓" },
        { href: "/community", label: "المجموعات الدراسية", icon: "👥" },
        { href: "/support", label: "الرسائل الخاصة", icon: "💬" },
      ]
    },
    {
      title: "أدوات ومصادر",
      links: [
        { href: "/tools", label: "الأدوات المحاسبية", icon: "🧮" },
        { href: "/dictionary", label: "قاموس المصطلحات", icon: "🔖" },
        { href: "/telegram", label: "قنوات الملخصات", icon: "🚀" },
      ]
    },
    {
      title: "الدعم والإعدادات",
      links: [
        { href: "/support", label: "الدعم الفني", icon: "🎧" },
        { href: "/download", label: "تحميل تطبيق Android", icon: "📱" },
        { href: "/about", label: "حول التطبيق", icon: "ℹ️" },
      ]
    }
  ];

  // Dynamically insert specific dashboard link based on role
  if (user.role === "admin") {
    const supportCat = navCategories.find(c => c.title === "الدعم والإعدادات");
    if (supportCat && !supportCat.links.some(l => l.href === "/admin")) {
      supportCat.links.unshift({ href: "/admin", label: "لوحة الإدارة", icon: "◈" });
    }
  } else if (user.role === "representative") {
    const supportCat = navCategories.find(c => c.title === "الدعم والإعدادات");
    if (supportCat && !supportCat.links.some(l => l.href === "/representative/dashboard")) {
      supportCat.links.unshift({ href: "/representative/dashboard", label: "لوحة المندوب", icon: "◈" });
    }
  }

  for (const item of adminMenuItems.filter((entry) => entry.enabled && entry.roles.includes(user.role))) {
    const category = navCategories.find((entry) => entry.title === item.category);
    if (!category || category.links.some((link) => link.href === item.href && link.label === item.label)) continue;
    category.links.push({ href: item.href, label: item.label, icon: item.icon });
  }

  const visibleNavCategories = navCategories
    .map((category) => ({
      ...category,
      links: category.links.filter((link) => {
        const feature = routeFeature[link.href.split("?")[0]];
        return feature ? featureFlags[feature] !== false : true;
      }),
    }))
    .filter((category) => category.links.length > 0);

  return (
    <div className="relative min-h-screen bg-app">
      {/* Top Header Bar matching Image 1 */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-app bg-surface px-4 shadow-sm">
        
        {/* Right side: Hamburger menu button to trigger side drawer */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setDrawerOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-200 transition"
            aria-label="فتح القائمة الجانبية"
          >
            <span className="text-xl font-bold">☰</span>
          </button>
        </div>

        {/* Center: Theme toggle (Moon/Sun) */}
        <div className="flex items-center gap-2">
          <ThemeButton />
          <ConnectionBadge />
        </div>

        {/* Left side: Profile dropdown menu */}
        <div className="relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen(!profileOpen);
            }}
            className="flex items-center gap-1.5 rounded-full bg-[#087767]/10 p-1 pr-2 hover:bg-[#087767]/15 transition"
            aria-label="قائمة الحساب"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#087767] font-bold text-white text-sm">
              {initial}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300">▼</span>
          </button>

          {/* Profile Dropdown Container matching Image 1 (left side popup) */}
          {profileOpen && (
            <div 
              className="absolute left-0 mt-2 w-64 origin-top-left rounded-2xl border border-app bg-surface p-4 shadow-xl z-50 animate-rise"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-app pb-3 text-right">
                <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate">{user.fullName}</p>
                <p className="text-muted text-xs truncate mt-0.5" dir="ltr">{user.email}</p>
              </div>
              <div className="py-2 space-y-1">
                <Link 
                  href="/settings" 
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition text-right"
                  onClick={() => setProfileOpen(false)}
                >
                  <span>الملف الشخصي</span>
                </Link>
                <Link 
                  href="/settings" 
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition text-right"
                  onClick={() => setProfileOpen(false)}
                >
                  <span>الإعدادات</span>
                </Link>
              </div>
              <div className="border-t border-app pt-2">
                <button 
                  onClick={logout}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-extrabold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition text-right"
                >
                  <span>تسجيل الخروج </span>
                  <span>↳</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Sticky Bottom Navigation Bar for Mobile matching Image 1 */}
      <nav className="mobile-nav" aria-label="التنقل الرئيسي">
        <Link href="/ai" className={path === "/ai" ? "active" : ""}>
          <span className="text-xl">✨</span>
          <span>المساعد</span>
        </Link>
        <Link href="/support" className={path === "/support" ? "active" : ""}>
          <span className="text-xl">💬</span>
          <span>الرسائل</span>
        </Link>
        <Link href="/community" className={path === "/community" ? "active" : ""}>
          <span className="text-xl">👥</span>
          <span>المجتمع</span>
        </Link>
        <Link href="/courses" className={path === "/courses" ? "active" : ""}>
          <span className="text-xl">📖</span>
          <span>المواد</span>
        </Link>
        <Link href="/dashboard" className={path === "/dashboard" ? "active" : ""}>
          <span className="text-xl">⌂</span>
          <span>الرئيسية</span>
        </Link>
      </nav>

      {/* Categorized Drawer Side Menu (Image 4 & 5) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay backdrop */}
          <div 
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Drawer sidebar panel */}
          <aside className="relative flex h-full w-[18rem] flex-col bg-surface border-r border-app shadow-2xl animate-rise overflow-hidden">
            {/* Drawer Header with Close Button */}
            <div className="flex items-center justify-between border-b border-app p-4 bg-slate-50/50 dark:bg-slate-900/20">
              <button 
                onClick={() => setDrawerOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
                aria-label="إغلاق القائمة"
              >
                ✕
              </button>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl brand-gradient text-white text-base">
                  📚
                </span>
                <div className="text-right">
                  <strong className="block text-sm leading-none">رفيقي</strong>
                  <small className="text-[10px] text-muted leading-none">رفيقك في طريقك الأكاديمي</small>
                </div>
              </div>
            </div>

            {/* Categorized list of navigation links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {visibleNavCategories.map((category) => (
                <div key={category.title} className="space-y-1">
                  <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 pb-1 text-right">
                    {category.title}
                  </h4>
                  <div className="space-y-0.5">
                    {category.links.map((link) => {
                      const isActive = path === link.href || (path?.startsWith(link.href) && link.href !== "/dashboard" && link.href !== "/ai" && link.href !== "/library" && link.href !== "/community");
                      return (
                        <Link 
                          key={link.label}
                          href={link.href}
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-right ${isActive ? "bg-[#087767]/10 text-[#087767] font-extrabold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/20"}`}
                        >
                          <span className="text-base">{link.icon}</span>
                          <span className="flex-1">{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* User details at bottom of Drawer */}
            <div className="border-t border-app p-4 bg-slate-50/50 dark:bg-slate-900/10 text-right">
              <strong className="block text-xs truncate">{user.fullName}</strong>
              <small className="text-[10px] text-muted block mt-0.5 truncate" dir="ltr">{user.email}</small>
              <span className="inline-block mt-1.5 text-[9px] bg-emerald-50 text-[#087767] dark:bg-emerald-950/40 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-md">
                {user.role === "admin" ? "مدير النظام" : user.role === "representative" ? "مندوب طلابي" : user.role === "support" ? "موظف دعم" : "طالب"}
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
