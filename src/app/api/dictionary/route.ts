import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { academicTerms } from "@/db/schema";
import { errorResponse, requireRole, requireUser } from "@/lib/auth";

export async function GET(request:Request){try{await requireUser();const q=new URL(request.url).searchParams.get("q")?.trim();const terms=await db.select().from(academicTerms).where(and(eq(academicTerms.isActive,true),q?or(ilike(academicTerms.termAr,`%${q}%`),ilike(academicTerms.termEn,`%${q}%`),ilike(academicTerms.meaning,`%${q}%`)):undefined)).orderBy(asc(academicTerms.termAr)).limit(100);return Response.json({terms})}catch(error){return errorResponse(error)}}
export async function POST(request:Request){try{await requireRole("admin");const b=await request.json();if(!b.termAr?.trim()||!b.termEn?.trim()||!b.meaning?.trim()||!b.category?.trim())return Response.json({error:"المصطلحان والمعنى والتصنيف مطلوبة"},{status:400});const[term]=await db.insert(academicTerms).values({termAr:b.termAr.trim(),termEn:b.termEn.trim(),meaning:b.meaning.trim(),simpleExplanation:b.simpleExplanation?.trim()||null,example:b.example?.trim()||null,category:b.category.trim()}).returning();return Response.json({term},{status:201})}catch(error){return errorResponse(error)}}
