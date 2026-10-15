import type { ReactNode } from "react";
import { PublicPageLayout } from "./public-page-layout";
import styles from "./site-shell.module.css";

export function SitePage({ active, title, children, contentClassName }: { active: string; title?: string; children: ReactNode; contentClassName?: string }) {
  return <PublicPageLayout active={active} contentClassName={[styles.content, contentClassName].filter(Boolean).join(" ")}>
    {title && <h1>{title}</h1>}{children}
  </PublicPageLayout>;
}
