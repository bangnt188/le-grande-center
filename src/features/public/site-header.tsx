"use client";

import { useRef } from "react";
import Link from "next/link";
import { useWebsiteSettings } from "./website-settings";
import { PUBLIC_NAVIGATION } from "./site-content";
import styles from "./site-shell.module.css";

export function SiteHeader({ active = "/", overlay = false, showAdminLink = false }: { active?: string; overlay?: boolean; showAdminLink?: boolean }) {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => mobileMenu.current?.removeAttribute("open");
  const navigateToTop = () => {
    closeMenu();
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const { logoUrl } = useWebsiteSettings();
  const links = PUBLIC_NAVIGATION.map(item => <Link key={item.href} href={item.href} data-ui-interaction="underline" prefetch={false} onNavigate={navigateToTop} aria-current={active === item.href ? "page" : undefined} className={item.href === "/lien-he/" ? styles.visitLink : undefined}>{item.label}{item.href === "/lien-he/" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>}</Link>);
  const navigation = links;
  return <header className={`${styles.header} ${overlay ? styles.overlay : ""}`} data-ui-interaction-group="colors">
    <Link href="/" className={styles.brand} aria-label="Le Grande Centre — Trang chủ" onNavigate={navigateToTop}>
      <img className={styles.brandMark} src={logoUrl} width="40" height="40" alt=""/>
      <span className={styles.brandText}><strong>Le Grande</strong><span>Centre</span></span>
    </Link>
    <nav className={styles.desktopNavigation} aria-label="Điều hướng chính">{navigation}</nav>
    <details className={styles.mobileMenu} ref={mobileMenu} onKeyDown={event => { if (event.key === "Escape") { closeMenu(); mobileMenu.current?.querySelector("summary")?.focus(); } }}>
      <summary>Menu<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5"/></svg></summary>
      <nav aria-label="Điều hướng chính trên điện thoại">{navigation}</nav>
    </details>
    {showAdminLink && <Link className={styles.adminLink} href="/admin-preview/" prefetch={false} onNavigate={navigateToTop}>Quản trị</Link>}
  </header>;
}
