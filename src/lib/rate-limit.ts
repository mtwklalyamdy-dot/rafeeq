import { createHash } from "crypto";
import { headers } from "next/headers";

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = 0;

export async function checkRateLimit(scope: string, limit: number, windowMs: number, identifier = "shared") {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const fingerprint = createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex");
  const key = `${scope}:${ip}:${fingerprint}`;
  const now = Date.now();

  if (now - lastCleanup > 10 * 60 * 1000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
    lastCleanup = now;
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: `طلبات كثيرة. حاول بعد ${retryAfter} ثانية.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
