import { redirect } from "next/navigation";
import { AdminClient } from "@/components/admin-client";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/dashboard");
  return <AdminClient />;
}
