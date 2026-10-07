import Link from "next/link";
import type { ProjectReason, ProjectReasonsContent } from "./project-reasons-model";
import styles from "./project-reasons.module.css";

function ReasonIcon({ kind }: { kind: ProjectReason["icon"] }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    {kind === "location" && <><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></>}
    {kind === "community" && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/></>}
    {kind === "design" && <><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8L2 8v12a2 2 0 0 0 2 2Z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></>}
    {kind === "management" && <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>}
    {kind === "growth" && <><path d="m1 18 7.5-7.5 5 5L23 6M17 6h6v6"/></>}
    {kind === "transparency" && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>}
  </svg>;
}

// Kept ready for composition; no page enables this section implicitly.
export function ProjectReasons({ content, id = "project-reasons" }: {
  content: ProjectReasonsContent;
  id?: string;
}) {
  return <section id={id} className={styles.section} aria-labelledby={`${id}-heading`}>
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.label}>{content.label}</p>
        <div className={styles.divider} aria-hidden="true"/>
        <h2 id={`${id}-heading`} className={styles.title}>{content.title}<br/><em>{content.titleEmphasis}</em></h2>
        <p className={styles.subtitle}>{content.description}</p>
      </div>
      <ol className={styles.grid}>{content.reasons.map((reason, index) => <li key={reason.id} className={styles.card}>
        <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className={styles.icon}><ReasonIcon kind={reason.icon}/></div>
        <h3 className={styles.cardTitle}>{reason.title}</h3>
        <p className={styles.description}>{reason.description}</p>
        <div className={styles.cardLine} aria-hidden="true"/>
      </li>)}</ol>
      {content.cta && <div className={styles.cta}>
        <div><h3 className={styles.ctaTitle}>{content.cta.title}</h3><p className={styles.ctaDescription}>{content.cta.description}</p></div>
        <Link href={content.cta.href} className={styles.ctaLink} prefetch={false}>{content.cta.label}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></Link>
      </div>}
    </div>
  </section>;
}
