import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { levels, profiles, telegramChannels } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    
    // Filter strictly by the student's level so they see relevant telegram channels
    const channels = await db.select({ id: telegramChannels.id, title: telegramChannels.title, description: telegramChannels.description, url: telegramChannels.url, verifiedAt: telegramChannels.verifiedAt, level: levels.nameAr, sortOrder: levels.sortOrder })
      .from(telegramChannels)
      .innerJoin(levels, eq(telegramChannels.levelId, levels.id))
      .where(and(
        eq(telegramChannels.isActive, true),
        profile?.levelId ? eq(telegramChannels.levelId, profile.levelId) : undefined
      ))
      .orderBy(asc(levels.sortOrder));
    return Response.json({ channels });
  } catch (error) { return errorResponse(error); }
}
