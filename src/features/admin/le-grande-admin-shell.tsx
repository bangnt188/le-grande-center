"use client";
import { useState, type ReactNode } from "react";
import { AdminShell, Select, Badge, type AdminNavigationItem, type AdminShellMode } from "@mall/ui";
import { AdminToastViewport } from "./admin-notifications";
import { adminLogoUrl } from "./demo-data";
export function LeGrandeAdminShell({ navigation, activeItemId, location, children }: { navigation: AdminNavigationItem[]; activeItemId: string; location: ReactNode; children: ReactNode }) {
  const [mode, setMode] = useState<AdminShellMode>("sidebar");
  return <div className="legrande-admin" data-ui-root data-ui-theme="shopping-mall" data-ui-scheme="light" data-ui-density="compact"><AdminShell className="mall-admin-shell" mainId="admin-workspace" mode={mode} navigation={navigation} activeItemId={activeItemId} navigationLabel="Điều hướng quản trị" brand={{ name: "Le Grande Centre", description: "Quản lý khai thác", mark: <img src={adminLogoUrl} alt="" width={42} height={42}/>, destination: { kind: "link", href: "https://legrandecentre.vn/" } }} location={location} headerActions={<><label className="shell-mode"><span className="sr-only">Bố cục quản trị</span><Select aria-label="Bố cục quản trị" value={mode} onChange={event => setMode(event.target.value as AdminShellMode)}><option value="sidebar">Sidebar</option><option value="topnav">Điều hướng ngang</option></Select></label><Badge tone="warning">Demo</Badge></>} sidebarFooter={<><strong>Le Grande Centre</strong><p>6 tầng cố định</p><Badge tone="warning">Dữ liệu mẫu · Lưu trong phiên</Badge></>}  footer={<div className="admin-footer"><span>Le Grande Centre · Không gian quản trị</span><span>Prototype tương tác · Chưa kết nối hệ thống</span></div>}>{children}</AdminShell><AdminToastViewport/></div>;
}
