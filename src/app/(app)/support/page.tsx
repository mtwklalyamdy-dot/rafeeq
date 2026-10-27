import { redirect } from "next/navigation";
import { SupportAgentClient } from "@/components/support-agent-client";
import { SupportClient } from "@/components/support-client";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user || !user.emailVerifiedAt) redirect("/");
  if (user.role === "support" || user.role === "admin") return <SupportAgentClient staffId={user.id} />;
  return <SupportClient />;
}
