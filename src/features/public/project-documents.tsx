import { siteUrl } from "@/config/site";
import styles from "./project-documents.module.css";

import type { ProjectDocumentGroup } from "./project-document-model";

function DocumentIcon({ kind }: { kind: ProjectDocumentGroup["icon"] }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {kind === "document" ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></> : kind === "plan" ? <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/></> : <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>}
  </svg>;
}

function DownloadIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
}

export function ProjectDocuments({ groups }: { groups: readonly ProjectDocumentGroup[] }) {
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  return <section id="documents" className={styles.section} aria-labelledby="project-documents-heading">
    <div className={styles.heading}>
      <p className={styles.label}>Tài Liệu Dự Án</p>
      <h2 id="project-documents-heading">Công Khai <em>&amp; Minh Bạch</em></h2>
      <p className={styles.subtitle}>Khám phá quy mô biểu tượng, phân bổ mặt bằng thiết kế và các chứng từ pháp lý minh bạch của Le Grande Centre</p>
    </div>
    <div className={styles.grid}>{groups.map(group => <article key={group.id} className={styles.document}>
      <div className={styles.icon}><DocumentIcon kind={group.icon}/></div>
      <h3>{group.title}</h3><p className={styles.description}>{group.description}</p>
      <div className={styles.downloads}>{group.downloads.map((item, index) => <div key={item.label}>
        {item.path ? <a className={styles.download} href={`${assetBase}${item.path}`} download={item.filename}>{item.label}<DownloadIcon/></a> : <><button className={styles.download} type="button" disabled aria-describedby={`document-${group.id}-${index}-pending`}>{item.label}<DownloadIcon/></button><p className={styles.pending} id={`document-${group.id}-${index}-pending`}>{item.pending}</p></>}
      </div>)}</div>
    </article>)}</div>
  </section>;
}
