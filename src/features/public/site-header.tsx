import Link from "next/link";
import { PUBLIC_NAVIGATION } from "./site-content";
import styles from "./site-shell.module.css";

export function SiteHeader({ active = "/", overlay = false, showAdminLink = false }: { active?: string; overlay?: boolean; showAdminLink?: boolean }) {
  const links = PUBLIC_NAVIGATION.map(item => <Link key={item.href} href={item.href} prefetch={false} aria-current={active === item.href ? "page" : undefined}>{item.label}</Link>);
  return <header className={`${styles.header} ${overlay ? styles.overlay : ""}`}>
    <Link href="/" className={styles.brand} aria-label="Le Grande Centre — Trang chủ">Le Grande<span>Centre</span></Link>
    <nav className={styles.desktopNavigation} aria-label="Điều hướng chính">{links}</nav>
    <details className={styles.mobileMenu}>
      <summary>Menu<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5"/></svg></summary>
      <nav aria-label="Điều hướng chính trên điện thoại">{links}</nav>
    </details>
    {showAdminLink && <Link className={styles.adminLink} href="/admin-preview/" prefetch={false}>Quản trị</Link>}
  </header>;
}
