import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_FULL_NAME) {
  console.error("يلزم ضبط DATABASE_URL وADMIN_EMAIL وADMIN_PASSWORD وADMIN_FULL_NAME كأسرار بيئية.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12 || !/[A-Za-z]/.test(ADMIN_PASSWORD) || !/[0-9]/.test(ADMIN_PASSWORD)) {
  console.error("كلمة مرور المدير يجب أن تكون 12 حرفًا على الأقل وتحتوي حرفًا ورقمًا.");
  process.exit(1);
}
const email = ADMIN_EMAIL.trim().toLowerCase();
const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  const existing = await pool.query("select id from users where email=$1", [email]);
  if (existing.rowCount) throw new Error("البريد مسجل بالفعل؛ لن يغيّر السكربت دور حساب موجود.");
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await pool.query("insert into users(full_name,email,password_hash,role,email_verified_at) values($1,$2,$3,'admin',now())", [ADMIN_FULL_NAME.trim(), email, hash]);
  console.log("تم إنشاء حساب المدير وتوثيقه. احذف متغيرات ADMIN_* بعد أول دخول.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "تعذر إنشاء المدير");
  process.exitCode = 1;
} finally {
  await pool.end();
}
