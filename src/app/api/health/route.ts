import { db } from "@/db";
import { sql } from "drizzle-orm";
import { isGeminiConfigured } from "@/lib/gemini";
import { isMailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.execute(sql<{ count: number }>`select count(*)::int as count from information_schema.tables where table_schema='public'`);
    return Response.json({
      ok: true,
      app: "رفيقي",
      database: { connected: true, tables: result.rows[0]?.count ?? 0 },
      services: { emailConfigured: isMailConfigured(), geminiConfigured: isGeminiConfigured(), pushConfigured: false, fileStorage: "local-private" },
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, database: { connected: false } }, { status: 500 });
  }
}
