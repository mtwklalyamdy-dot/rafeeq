import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
export default async function VerifyPage({searchParams}:{searchParams:Promise<{email?:string}>}){const {email}=await searchParams;return <AuthShell eyebrow="حماية الحساب"><VerifyForm email={email||""}/></AuthShell>}
