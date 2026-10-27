import test from "node:test";
import assert from "node:assert/strict";
import { effectiveRole, isConfiguredAdmin } from "../src/lib/admin-access.ts";

const allowlist = "mtwklalyamdy@gmail.com, tawfeeqalzaide@gmail.com";

test("configured administrator emails receive admin access without changing stored role", () => {
  assert.equal(effectiveRole("tawfeeqalzaide@gmail.com", "support", allowlist), "admin");
  assert.equal(effectiveRole(" Mtwklalyamdy@Gmail.com ", "admin", allowlist), "admin");
  assert.equal(effectiveRole("student@example.com", "student", allowlist), "student");
  assert.equal(effectiveRole("support@example.com", "support", allowlist), "support");
});

test("admin allowlist matching is normalized and empty entries are ignored", () => {
  assert.equal(isConfiguredAdmin("TAWFEEQALZAIDE@GMAIL.COM", " , tawfeeqalzaide@gmail.com, ,"), true);
  assert.equal(isConfiguredAdmin("other@example.com", " , ,"), false);
});
