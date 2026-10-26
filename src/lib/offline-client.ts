export type OfflineItem = { id: string; title: string; url: string; size?: number; course?: string; version?: number; savedAt: string };
const KEY = "rafeeq-offline-library";
export function getOfflineItems(): OfflineItem[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export async function saveOfflineItem(item: Omit<OfflineItem, "savedAt">, onProgress?: (value: number) => void) {
  if (!("caches" in window)) throw new Error("المتصفح لا يدعم التخزين دون اتصال");
  onProgress?.(10);
  const response = await fetch(item.url);
  if (!response.ok) throw new Error("تعذر تنزيل الملف");
  onProgress?.(55);
  const cache = await caches.open("rafeeq-offline-files-v1");
  await cache.put(item.url, response.clone());
  onProgress?.(90);
  const items = getOfflineItems().filter((entry) => entry.id !== item.id);
  items.unshift({ ...item, savedAt: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(items));
  onProgress?.(100);
}
export async function removeOfflineItem(id: string) {
  const item = getOfflineItems().find((entry) => entry.id === id);
  if (item) { const cache = await caches.open("rafeeq-offline-files-v1"); await cache.delete(item.url); }
  localStorage.setItem(KEY, JSON.stringify(getOfflineItems().filter((entry) => entry.id !== id)));
}
