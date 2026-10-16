import type { Metadata } from "next";
import AdminWorkspace from "../admin-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản lý khai thác", robots: { index: false, follow: false } };

export default function AdminWorkspacePage() {
  return <AdminWorkspace />;
}
