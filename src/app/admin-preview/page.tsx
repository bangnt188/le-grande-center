import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deploymentTarget } from "@/config/deployment";
import AdminWorkspace from "./admin-workspace";
import "./admin-preview.css";
import "./b2b-workspace.css";
import "./mall-system.css";

export const metadata: Metadata = {
  title: "Quản lý mặt bằng · Admin demo",
  robots: { index: false, follow: false },
};

export default function AdminPreviewPage() {
  if (deploymentTarget() === "server") notFound();
  return <AdminWorkspace />;
}
