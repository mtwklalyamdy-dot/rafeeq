/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";

export function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem("rafeeq-theme") === "dark" || (!localStorage.getItem("rafeeq-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(value); document.documentElement.classList.toggle("dark", value);
  }, []);
  function toggle() { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("rafeeq-theme", next ? "dark" : "light"); }
  return <button onClick={toggle} className="btn-secondary !h-10 !w-10 !p-0" aria-label={dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}>{dark ? "☀" : "◐"}</button>;
}

export function PwaRegister() {
  useEffect(() => { 
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => {
          // Attempt silently to register push subscription if permission was already granted
          if ("Notification" in window && Notification.permission === "granted") {
            registerPushSubscription(reg);
          }
        })
        .catch(() => undefined); 
    }
  }, []);
  return null;
}

async function registerPushSubscription(reg: ServiceWorkerRegistration) {
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // Use standard applicationServerKey (mock VAPID public key or configured VAPID key)
      const base64VapidPublic = "BJh3_XbCHlPZ2T8wWv6K0rK0A-P8U2N5Ew2_O_ZfN0c4w7K5L5V_C-g2h_T-G5V3W_A-X_Q";
      const convertedKey = urlBase64ToUint8Array(base64VapidPublic);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // Post subscription object to server
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub)
    });
  } catch {}
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function WebPushPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if Web Push is supported and not yet decided
    if ("Notification" in window && Notification.permission === "default") {
      // Delay prompt by 5 seconds to not disturb first-page load experience
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  async function requestPermission() {
    setShow(false);
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await registerPushSubscription(reg);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 card p-4 animate-rise max-w-sm mx-auto flex flex-col gap-3 border-[#087767]/30 bg-surface shadow-2xl">
      <div className="flex gap-3">
        <span className="text-2xl">🔔</span>
        <div className="text-right">
          <strong className="block text-xs font-black text-slate-800 dark:text-slate-100">تفعيل الإشعارات الفورية</strong>
          <p className="text-[10px] text-muted mt-1 leading-5">تلقى تنبيهات فورية للمحاضرات والواجبات والاختبارات وتحديثات المندوب أولاً بأول.</p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setShow(false)} className="rounded-xl px-3 py-1.5 text-[10px] text-muted hover:bg-slate-50">لاحقاً</button>
        <button onClick={requestPermission} className="rounded-xl bg-[#087767] text-white px-4 py-1.5 text-[10px] font-black hover:bg-[#055b50]">سماح بتلقي الإشعارات</button>
      </div>
    </div>
  );
}

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("rafeeq-splash-seen")) return;
    sessionStorage.setItem("rafeeq-splash-seen", "1");
    setVisible(true);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setVisible(false), reduced ? 100 : 700);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div className="brand-gradient fixed inset-0 z-[100] grid place-items-center text-white" role="status" aria-label="جارٍ فتح رفيقي"><div className="text-center"><span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-white/15 text-4xl">⌁</span><strong className="mt-5 block text-4xl">رفيقي</strong><p className="mt-2 text-white/70">رفيقك في طريقك الأكاديمي</p><small className="mt-10 block text-white/55">© 2026 فاروق مقبول الوصابي</small></div></div>;
}

export function ConnectionBadge() {
  const [online, setOnline] = useState(true);
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); addEventListener("online", update); addEventListener("offline", update); return () => { removeEventListener("online", update); removeEventListener("offline", update); }; }, []);
  return <span className="badge"><i className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />{online ? "متصل" : "دون اتصال"}</span>;
}
