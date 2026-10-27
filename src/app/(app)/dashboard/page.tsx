import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard-client";
export const metadata:Metadata={title:"الرئيسية"};
export default function DashboardPage(){return <DashboardClient/>}
