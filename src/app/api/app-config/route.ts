import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await db.select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)
      .where(inArray(appSettings.key, ["main_menu", "feature_flags"]));
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return Response.json({ menu: Array.isArray(values.main_menu) ? values.main_menu : [], featureFlags: values.feature_flags || {} }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
