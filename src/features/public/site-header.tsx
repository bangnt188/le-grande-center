"use client";

import { useRef } from "react";
import Link from "next/link";
import { siteUrl } from "@/config/site";
import { PUBLIC_NAVIGATION } from "./site-content";
import styles from "./site-shell.module.css";

export function SiteHeader({ active = "/", overlay = false, showAdminLink = false }: { active?: string; overlay?: boolean; showAdminLink?: boolean }) {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => mobileMenu.current?.removeAttribute("open");
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  const links = PUBLIC_NAVIGATION.map(item => <Link key={item.href} href={item.href} prefetch={false} onNavigate={closeMenu} aria-current={active === item.href ? "page" : undefined}>{item.label}</Link>);
  return <header className={`${styles.header} ${overlay ? styles.overlay : ""}`}>
    <Link href="/" className={styles.brand} aria-label="Le Grande Centre — Trang chủ" onNavigate={closeMenu}>
      <img className={styles.brandMark} src={`${assetBase}/client-reference/legacy/logo-without-text.png`} width="48" height="48" alt=""/>
      <span className={styles.brandText}><strong>Le Grande</strong><span>Centre</span></span>
    </Link>
    <nav className={styles.desktopNavigation} aria-label="Điều hướng chính">{links}</nav>
    <details className={styles.mobileMenu} ref={mobileMenu}>
      <summary>Menu<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5"/></svg></summary>
      <nav aria-label="Điều hướng chính trên điện thoại">{links}</nav>
    </details>
    {showAdminLink && <Link className={styles.adminLink} href="/admin-preview/" prefetch={false}>Quản trị</Link>}
  </header>;
}
