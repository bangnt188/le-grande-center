import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import shell from "./site-shell.module.css";
import project from "./canva-pages.module.css";
import { ScrollMotion } from "@mall/ui/motion";
export function PublicPageLayout({ active, children, variant = "editorial", contentClassName }: {
  active: string;
  children: ReactNode;
  variant?: "editorial" | "project";
  contentClassName?: string;
}) {
  return <div className={variant === "project" ? project.page : shell.page}>
    <ScrollMotion refreshKey={active} revealSelector="#main-content > section, #main-content > div > section, #main-content > div > h1, #main-content > div > p" />
    <SiteHeader active={active}/>
    <main id="main-content" className={contentClassName}>{children}</main>
    <SiteFooter/>
  </div>;
}
