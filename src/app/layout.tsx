import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister, SplashScreen, WebPushPrompt } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "رفيقي — رفيقك في طريقك الأكاديمي", template: "%s | رفيقي" },
  description: "منصة أكاديمية عربية لطلاب الجامعات في اليمن — المواد والملخصات والواجبات ومجتمع رفيقي.",
  applicationName: "رفيقي",
  authors: [{ name: "فاروق مقبول الوصابي" }],
  creator: "فاروق مقبول الوصابي",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "رفيقي" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0b7a68", width: "device-width", initialScale: 1, maximumScale: 5 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body><PwaRegister /><SplashScreen /><WebPushPrompt />{children}</body>
    </html>
  );
}
