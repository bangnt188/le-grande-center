"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell, Button, Badge, type AdminNavigationItem } from "@mall/ui";
import { AdminToastViewport } from "./admin-notifications";
import { adminLogoUrl } from "./demo/data";

export function LeGrandeAdminShell({ navigation, activeItemId, location, children, onLogout, propertyName = "Le Grande Centre" }: { navigation: AdminNavigationItem[]; activeItemId: string; location: ReactNode; children: ReactNode; onLogout: () => void; propertyName?: string }) {
  return <div className="legrande-admin" data-ui-root data-ui-theme="shopping-mall" data-ui-scheme="light" data-ui-density="compact">
    <AdminShell className="mall-admin-shell" mainId="admin-workspace" mode="sidebar" navigation={navigation} activeItemId={activeItemId} navigationLabel="Điều hướng quản trị" brand={{ name: propertyName, description: "Quản lý khai thác", mark: <img src={adminLogoUrl} alt="" width={42} height={42}/> }} location={location} headerActions={<>
      <Link className="admin-website-link" href="/" target="_blank" rel="noopener noreferrer" prefetch={false}>Mở website<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/></svg></Link>
      <Button variant="quiet" size="sm" onClick={onLogout}>Đăng xuất</Button>
    </>} sidebarFooter={<><strong>Quản trị nội bộ</strong><p>6 tầng cố định</p><Badge tone="warning">Bản dùng thử</Badge></>} footer={<div className="admin-footer"><span>{propertyName} · Không gian quản trị</span><span>Lưu trên trình duyệt này · Chưa kết nối DB</span></div>}>{children}</AdminShell>
    <AdminToastViewport/>
  </div>;
}
