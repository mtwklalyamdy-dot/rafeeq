import { redirect } from "next/navigation";
import { RepresentativeClient } from "@/components/representative-client";
import { getCurrentUser } from "@/lib/auth";

export default async function RepresentativeDashboard() {
  const user = await getCurrentUser();
  if (user?.role !== "representative" || user.representativeStatus !== "approved") redirect("/representative/login");
  return <RepresentativeClient />;
}
