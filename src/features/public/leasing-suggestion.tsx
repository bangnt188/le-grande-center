import Link from "next/link";
import styles from "./canva-pages.module.css";

export function LeasingSuggestion({ unitId }: { unitId?: string }) {
  const href = unitId ? { pathname: "/lien-he/", query: { unit: unitId } } : "/lien-he/";
  return <section className={styles.suggestion}><h2>Mô tả mô hình của bạn,<br/><em>chúng tôi giúp tìm vị trí phù hợp nhất.</em></h2><Link className={styles.primary} href={href}>Trao đổi nhu cầu thuê <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5"/></svg></Link></section>;
}
