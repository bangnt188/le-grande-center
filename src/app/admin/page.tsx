import type { Metadata } from "next";
import { Suspense } from "react";
import AdminEntry from "@/features/admin/admin-entry";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false, follow: false } };
export default function AdminPage() { return <Suspense><AdminEntry/></Suspense>; }
