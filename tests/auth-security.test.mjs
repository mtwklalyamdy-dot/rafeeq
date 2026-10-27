import test from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

function otpPayload(userId, purpose, code) {
  return `${userId}:${purpose}:${code}`;
}

test("OTP العشوائي مخزن كتجزئة مملحة ومرتبط بالمستخدم والغرض", async () => {
  const userId = randomUUID();
  const code = String(randomInt(100000, 1000000));
  const hash = await bcrypt.hash(otpPayload(userId, "verify_email", code), 12);

  assert.equal(hash.includes(code), false);
  assert.equal(await bcrypt.compare(otpPayload(userId, "verify_email", code), hash), true);
  assert.equal(await bcrypt.compare(otpPayload(userId, "reset_password", code), hash), false);
  assert.equal(await bcrypt.compare(otpPayload(randomUUID(), "verify_email", code), hash), false);
  assert.equal(await bcrypt.compare(otpPayload(userId, "verify_email", String(Number(code) + 1)), hash), false);
});
