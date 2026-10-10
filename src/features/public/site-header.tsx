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
  const links = PUBLIC_NAVIGATION.map(item => <Link key={item.href} href={item.href} prefetch={false} onNavigate={closeMenu} aria-current={active === item.href ? "page" : undefined} className={item.href === "/lien-he/" ? styles.visitLink : undefined}>{item.label}{item.href === "/lien-he/" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>}</Link>);
  return <header className={`${styles.header} ${overlay ? styles.overlay : ""}`}>
    <Link href="/" className={styles.brand} aria-label="Le Grande Centre — Trang chủ" onNavigate={closeMenu}>
      <img className={styles.brandMark} src={`${assetBase}/client-reference/legacy/logo-without-text.png`} width="40" height="40" alt=""/>
      <span className={styles.brandText}><strong>Le Grande</strong><span>Centre</span></span>
    </Link>
    <nav className={styles.desktopNavigation} aria-label="Điều hướng chính">{links.slice(0, -1)}<Link className={styles.exploreLink} href="/kham-pha/" prefetch={false}>KHÁM PHÁ 3D <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></Link>{links.at(-1)}</nav>
    <details className={styles.mobileMenu} ref={mobileMenu} onKeyDown={event => { if (event.key === "Escape") { closeMenu(); mobileMenu.current?.querySelector("summary")?.focus(); } }}>
      <summary>Menu<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5"/></svg></summary>
      <nav aria-label="Điều hướng chính trên điện thoại">{links}</nav>
    </details>
    {showAdminLink && <Link className={styles.adminLink} href="/admin-preview/" prefetch={false}>Quản trị</Link>}
  </header>;
}
