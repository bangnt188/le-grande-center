import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminWorkspace from "../admin-workspace";
import { requireAdmin, AuthError } from "@/server/auth";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản lý khai thác", robots: { index: false, follow: false } };
export default async function AdminWorkspacePage() {
  try { await requireAdmin(); } catch (error) { if (error instanceof AuthError) redirect(error.status === 401 ? "/admin/" : "/admin/?denied=1"); throw error; }
  return <AdminWorkspace/>;
}
