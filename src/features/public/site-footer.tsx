import Link from "next/link";
import { ADDRESS, EMAIL, PUBLIC_NAVIGATION, LEASING_PHONES, MANAGEMENT_PHONE } from "./site-content";
import styles from "./site-shell.module.css";

export function SiteFooter() {
  return <footer className={styles.footer}>
    <section><Link className={styles.footerBrand} href="/">Le Grande Centre</Link><p>Nơi hội tụ thương mại – văn phòng – giải trí trong một không gian tinh tế và hiện đại.</p></section>
    <section><h2>Liên hệ</h2><address>{ADDRESS}</address><p>Cho thuê</p>{LEASING_PHONES.map(phone => <a key={phone.href} href={phone.href}>{phone.label}</a>)}<p>Ban quản lý</p><a href={MANAGEMENT_PHONE.href}>{MANAGEMENT_PHONE.label}</a><a href={`mailto:${EMAIL}`}>{EMAIL}</a></section>
    <nav aria-label="Khám phá dự án"><h2>Khám phá</h2>{PUBLIC_NAVIGATION.filter(item => item.href !== "/").map(item => <Link key={item.href} href={item.href} prefetch={false}>{item.label}</Link>)}</nav>
  </footer>;
}
