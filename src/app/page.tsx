import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function LoginPage(){const user=await getCurrentUser();if(user?.emailVerifiedAt)redirect(user.role==="representative"?"/representative/dashboard":user.role==="admin"?"/admin":user.role==="support"?"/support":"/dashboard");return <AuthShell><LoginForm/></AuthShell>}
