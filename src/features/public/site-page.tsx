import type { ReactNode } from "react";
import { PublicPageLayout } from "./public-page-layout";
import styles from "./site-shell.module.css";

export function SitePage({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  return <PublicPageLayout active={active} contentClassName={styles.content}>
    <h1>{title}</h1>{children}
  </PublicPageLayout>;
}
