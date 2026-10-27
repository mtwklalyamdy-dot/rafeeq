export type AdminRole = "student" | "representative" | "support" | "admin";

export function configuredAdminEmails(value = process.env.RAFEEQ_ADMIN_EMAILS || "") {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function effectiveRole(email: string, storedRole: AdminRole, allowlist = process.env.RAFEEQ_ADMIN_EMAILS || ""): AdminRole {
  const normalized = email.trim().toLowerCase();
  return configuredAdminEmails(allowlist).includes(normalized) ? "admin" : storedRole;
}

export function isConfiguredAdmin(email: string, allowlist = process.env.RAFEEQ_ADMIN_EMAILS || "") {
  return configuredAdminEmails(allowlist).includes(email.trim().toLowerCase());
}
