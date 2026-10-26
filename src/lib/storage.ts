import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "data", "uploads");
export const MAX_FILE_SIZE = 12 * 1024 * 1024;

const allowed = new Set([
  "application/pdf",
  "text/plain",
  "image/jpeg",
  "image/png",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
]);

export async function savePrivateFile(file: File) {
  if (!allowed.has(file.type)) throw new FileValidationError("نوع الملف غير مسموح.");
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new FileValidationError("حجم الملف يجب أن يكون بين 1 بايت و12 ميجابايت.");
  const bytes = Buffer.from(await file.arrayBuffer());
  validateMagic(bytes, file.type);
  const storageKey = `${new Date().getUTCFullYear()}/${randomUUID()}`;
  const fullPath = safePath(storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes, { flag: "wx", mode: 0o600 });
  return {
    storageKey,
    originalName: sanitiseName(file.name),
    mimeType: file.type,
    sizeBytes: file.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function loadPrivateFile(storageKey: string) {
  return readFile(safePath(storageKey));
}

function safePath(storageKey: string) {
  const full = path.resolve(ROOT, storageKey);
  if (!full.startsWith(path.resolve(ROOT) + path.sep)) throw new FileValidationError("مسار ملف غير صالح.");
  return full;
}

function validateMagic(bytes: Buffer, mime: string) {
  if (mime === "application/pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") throw new FileValidationError("محتوى الملف لا يطابق PDF.");
  if (mime === "image/png" && bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new FileValidationError("محتوى الصورة غير صالح.");
  if (mime === "image/jpeg" && bytes.subarray(0, 3).toString("hex") !== "ffd8ff") throw new FileValidationError("محتوى الصورة غير صالح.");
  if (mime === "audio/wav" || mime === "audio/x-wav") {
    if (bytes.subarray(0, 4).toString() !== "RIFF" || bytes.subarray(8, 12).toString() !== "WAVE") throw new FileValidationError("ملف WAV غير صالح.");
  }
}

function sanitiseName(name: string) {
  return name.replace(/[\\/\0\r\n]/g, "_").slice(0, 255) || "file";
}

export class FileValidationError extends Error {}
