import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, syncOperations } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json() as { operations?: Array<{ id: string; entityType: string; entityId: string; operation: string; clientUpdatedAt: string; payload: Record<string, unknown> }> };
    if (!Array.isArray(body.operations) || body.operations.length > 50) return Response.json({ error: "قائمة المزامنة غير صالحة" }, { status: 400 });
    const results = [];
    for (const operation of body.operations) {
      if (operation.entityType !== "note" || !["create", "update", "delete"].includes(operation.operation)) {
        results.push({ id: operation.id, status: "rejected", reason: "نوع عملية غير مدعوم" }); continue;
      }
      const already = await db.query.syncOperations.findFirst({ where: and(eq(syncOperations.id, operation.id), eq(syncOperations.userId, user.id)) });
      if (already) { results.push({ id: operation.id, status: "already_processed", result: already.result }); continue; }
      const clientDate = new Date(operation.clientUpdatedAt);
      if (Number.isNaN(clientDate.getTime())) { results.push({ id: operation.id, status: "rejected", reason: "وقت غير صالح" }); continue; }
      const existing = await db.query.notes.findFirst({ where: and(eq(notes.id, operation.entityId), eq(notes.userId, user.id)) });
      let result: Record<string, unknown>;
      if (operation.operation === "create" && !existing) {
        const [created] = await db.insert(notes).values({ id: operation.entityId, userId: user.id, title: String(operation.payload.title || "ملاحظة"), body: String(operation.payload.body || ""), category: operation.payload.category ? String(operation.payload.category) : null, clientUpdatedAt: clientDate }).returning();
        result = { status: "applied", entity: created };
      } else if (!existing) result = { status: "missing" };
      else if (existing.clientUpdatedAt > clientDate) result = { status: "conflict", resolution: "server_newer", server: existing };
      else if (operation.operation === "delete") {
        const [deleted] = await db.update(notes).set({ deletedAt: new Date(), clientUpdatedAt: clientDate, version: existing.version + 1, updatedAt: new Date() }).where(and(eq(notes.id, existing.id), eq(notes.userId, user.id))).returning();
        result = { status: "applied", entity: deleted };
      } else {
        const [updated] = await db.update(notes).set({ title: String(operation.payload.title || existing.title), body: String(operation.payload.body || existing.body), category: operation.payload.category ? String(operation.payload.category) : null, clientUpdatedAt: clientDate, version: existing.version + 1, updatedAt: new Date() }).where(and(eq(notes.id, existing.id), eq(notes.userId, user.id))).returning();
        result = { status: "applied", entity: updated };
      }
      await db.insert(syncOperations).values({ id: operation.id, userId: user.id, entityType: operation.entityType, entityId: operation.entityId, operation: operation.operation, clientUpdatedAt: clientDate, result });
      results.push({ id: operation.id, ...result });
    }
    return Response.json({ results, syncedAt: new Date().toISOString() });
  } catch (error) { return errorResponse(error); }
}
