import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("البريد الإلكتروني غير صالح").max(254);
export const passwordSchema = z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف").max(128).regex(/[A-Za-z]/, "أضف حرفًا واحدًا على الأقل").regex(/[0-9]/, "أضف رقمًا واحدًا على الأقل");

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, "أدخل الاسم الكامل").max(160),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  university: z.string().trim().min(2, "أدخل الجامعة").max(180),
  college: z.string().trim().min(2, "أدخل الكلية").max(180),
  department: z.string().trim().min(2, "أدخل التخصص").max(180),
  level: z.coerce.number().int().min(1).max(12),
  semester: z.coerce.number().int().min(1).max(4),
  accountType: z.enum(["student", "representative"]).default("student"),
}).refine((value) => value.password === value.confirmPassword, { message: "كلمتا المرور غير متطابقتين", path: ["confirmPassword"] });

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const verifySchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/, "أدخل رمزًا من 6 أرقام"), purpose: z.enum(["verify_email", "reset_password"]).default("verify_email") });
export const resetPasswordSchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/), password: passwordSchema, confirmPassword: z.string() }).refine((v) => v.password === v.confirmPassword, { message: "كلمتا المرور غير متطابقتين", path: ["confirmPassword"] });
