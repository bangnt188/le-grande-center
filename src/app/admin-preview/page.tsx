import type { Metadata } from "next";
import AdminDemoEntry from "@/features/admin/admin-demo-entry";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị · Demo",
  robots: { index: false, follow: false },
};

export default function AdminPreviewPage() {
  return <AdminDemoEntry />;
}
