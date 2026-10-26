import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function ProtectedLayout({children}:{children:ReactNode}){const user=await getCurrentUser();if(!user||!user.emailVerifiedAt)redirect("/");return <AppShell user={user}>{children}</AppShell>}
