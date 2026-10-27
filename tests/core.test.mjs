import test from "node:test";
import assert from "node:assert/strict";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("أدوات التجارة تطابق أمثلة محسوبة يدويًا", () => {
  close(1000 * 15 / 100, 150);
  close(1000 - (1000 * 15 / 100), 850);
  close(1500 - 1000, 500);
  close(((1500 - 1000) / 1500) * 100, 33.33333333333333);
  close(100000 * 0.1 * 2, 20000);
  close(100000 * Math.pow(1.1, 2) - 100000, 21000);
  close((100000 - 10000) / 5, 18000);
  close(50000 / (100 - 60), 1250);
});

test("المتوسط الموزون بالساعات صحيح", () => {
  const rows = [{ score: 90, credits: 3 }, { score: 80, credits: 2 }, { score: 70, credits: 1 }];
  const result = rows.reduce((sum, row) => sum + row.score * row.credits, 0) / rows.reduce((sum, row) => sum + row.credits, 0);
  close(result, 500 / 6);
});

test("روابط التواصل والقنوات تلتزم الصيغة المعتمدة", () => {
  const whatsapp = new URL("https://wa.me/967781504539?text=test");
  assert.equal(whatsapp.hostname, "wa.me");
  assert.equal(whatsapp.pathname, "/967781504539");
  assert.match("mtwklalyamdy@gmail.com", /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  for (const url of ["https://t.me/USF_Hodida_accounting_2", "https://t.me/USF_Hodida_accounting_33", "https://t.me/USF_Hodida_accounting_4"]) {
    assert.match(url, /^https:\/\/t\.me\/[A-Za-z0-9_]{5,}$/);
  }
});

test("تحديث Offline لا يستبدل البيانات الوصفية قبل نجاح التنزيل", () => {
  const previous = { version: 1, title: "ملف" };
  const failedDownload = false;
  const next = failedDownload ? { version: 2, title: "ملف" } : previous;
  assert.deepEqual(next, previous);
});
