import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const subscription = await request.json();

    if (!subscription || !subscription.endpoint) {
      return Response.json({ error: "بيانات الاشتراك غير صالحة" }, { status: 400 });
    }

    // Load existing Web Push subscriptions list from appSettings
    const existing = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "push_subscriptions") });
    const list = existing ? (existing.value as any[]) : [];

    // Filter out old subscription for this endpoint if any, or matching user
    const filtered = list.filter((item: any) => item.endpoint !== subscription.endpoint && item.userId !== user.id);
    
    // Add new subscription
    filtered.push({
      userId: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys || null,
      createdAt: new Date().toISOString()
    });

    // Save back to DB
    await db.insert(appSettings).values({
      key: "push_subscriptions",
      value: filtered,
      isPublic: false,
      updatedBy: user.id,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: filtered, updatedBy: user.id, updatedAt: new Date() }
    });

    return Response.json({ ok: true, message: "تم تسجيل جهازك لاستقبال الإشعارات بنجاح." });
  } catch (error) {
    return errorResponse(error);
  }
}
