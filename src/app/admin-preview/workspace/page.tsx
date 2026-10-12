import type { Metadata } from "next";
import AdminWorkspace from "../admin-workspace";
import AdminDemoEntry from "@/features/admin/admin-demo-entry";

export const metadata: Metadata = {
  title: "Quản lý khai thác · Admin demo",
  robots: { index: false, follow: false },
};

export default function AdminWorkspacePage() {
  return <AdminDemoEntry><AdminWorkspace/></AdminDemoEntry>;
}
