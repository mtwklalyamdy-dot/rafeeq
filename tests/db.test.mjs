import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.after(async () => pool.end());

test("PostgreSQL يحفظ الإعدادات الدائمة والروابط الموثقة", async () => {
  const result = await pool.query("select count(*)::int as levels, (select count(*)::int from community_categories) as categories, (select count(*)::int from telegram_channels where url is null) as missing_urls from levels");
  assert.equal(result.rows[0].levels, 4);
  assert.equal(result.rows[0].categories, 11);
  assert.equal(result.rows[0].missing_urls, 1);
});

test("المستخدم وكلمة المرور وقيد البريد الفريد داخل معاملة معزولة", async () => {
  const client = await pool.connect();
  const email = `test-${crypto.randomUUID()}@example.invalid`;
  try {
    await client.query("begin");
    const hash = await bcrypt.hash("StrongPass123", 12);
    const inserted = await client.query("insert into users(full_name,email,password_hash,role) values($1,$2,$3,'student') returning id,email,email_verified_at", ["اختبار معزول", email, hash]);
    assert.equal(inserted.rows[0].email, email);
    assert.equal(inserted.rows[0].email_verified_at, null);
    assert.equal(await bcrypt.compare("StrongPass123", hash), true);
    assert.equal(await bcrypt.compare("WrongPass123", hash), false);
    await client.query("savepoint duplicate_test");
    await assert.rejects(client.query("insert into users(full_name,email,password_hash,role) values($1,$2,$3,'student')", ["مكرر", email, hash]), /duplicate key|unique/i);
    await client.query("rollback to savepoint duplicate_test");
    const count = await client.query("select count(*)::int as value from users where email=$1", [email]);
    assert.equal(count.rows[0].value, 1);
  } finally {
    await client.query("rollback");
    client.release();
  }
});

test("الجداول الحرجة والعلاقات الأساسية موجودة", async () => {
  const names = ["users", "sessions", "email_verifications", "courses", "assignments", "assignment_submissions", "exams", "notes", "sync_operations", "community_posts", "representatives", "support_messages", "ai_study_summaries"];
  const result = await pool.query("select table_name from information_schema.tables where table_schema='public' and table_name=any($1)", [names]);
  assert.deepEqual(new Set(result.rows.map(row => row.table_name)), new Set(names));
});
