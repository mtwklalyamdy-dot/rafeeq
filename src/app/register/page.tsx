import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
export default async function RegisterPage({searchParams}:{searchParams:Promise<{type?:string}>}){const {type}=await searchParams;const accountType=type==="representative"?"representative":"student";return <AuthShell eyebrow={accountType==="representative"?"بوابة ممثلي الطلاب":"حساب طالب جديد"}><RegisterForm accountType={accountType}/></AuthShell>}
