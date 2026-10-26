import { db } from "@/db";
import { files } from "@/db/schema";
import { errorResponse, requireUser } from "@/lib/auth";
import { FileValidationError, savePrivateFile } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) return Response.json({ error: "اختر ملفًا صالحًا" }, { status: 400 });
    const stored = await savePrivateFile(upload);
    const [record] = await db.insert(files).values({ ownerId: user.id, ...stored, isPublic: false }).returning();
    return Response.json({ file: record }, { status: 201 });
  } catch (error) {
    if (error instanceof FileValidationError) return Response.json({ error: error.message }, { status: 400 });
    return errorResponse(error);
  }
}
