export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function firstZodError(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message || "البيانات المدخلة غير صالحة";
}

export const project = {
  name: "رفيقي",
  tagline: "رفيقك في طريقك الأكاديمي",
  owner: "فاروق مقبول الوصابي",
  copyright: "© 2026 فاروق مقبول الوصابي — جميع الحقوق محفوظة",
  whatsapp: "+967781504539",
  whatsappUrl: "https://wa.me/967781504539?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%AD%D8%AA%D8%A7%D8%AC%20%D8%A5%D9%84%D9%89%20%D9%85%D8%B3%D8%A7%D8%B9%D8%AF%D8%A9%20%D8%A8%D8%AE%D8%B5%D9%88%D8%B5%20%D8%AA%D8%B7%D8%A8%D9%8A%D9%82%20%D8%B1%D9%81%D9%8A%D9%82%D9%8A.",
  email: "mtwklalyamdy@gmail.com",
  mailtoUrl: "mailto:mtwklalyamdy@gmail.com?subject=%D8%B7%D9%84%D8%A8%20%D8%AF%D8%B9%D9%85%20%E2%80%94%20%D8%AA%D8%B7%D8%A8%D9%8A%D9%82%20%D8%B1%D9%81%D9%8A%D9%82%D9%8A",
} as const;
