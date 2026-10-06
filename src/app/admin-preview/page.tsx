import type { Metadata } from "next";
import AdminWorkspace from "./admin-workspace";
import "./admin-preview.css";

export const metadata: Metadata = {
  title: "Quản lý mặt bằng · Admin demo",
  robots: { index: false, follow: false },
};

export default function AdminPreviewPage() {
  return <AdminWorkspace />;
}
