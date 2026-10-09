import type { ReactNode } from "react";
import Link from "next/link";
import { siteUrl } from "@/config/site";
import styles from "./canva-pages.module.css";

type ProjectImage = { path: string; alt: string; caption: string };

export function ProjectHero({ title, description, image }: {
  title: ReactNode;
  description: string;
  image: ProjectImage;
}) {
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  return <section className={styles.hero}>
    <div><h1>{title}</h1><p>{description}</p></div>
    <figure><img className={styles.heroImage} src={`${assetBase}${image.path}`} alt={image.alt} decoding="async"/><figcaption>{image.caption}</figcaption></figure>
  </section>;
}

export function ProjectOverview({ paragraphs }: { paragraphs: readonly string[] }) {
  return <section className={`${styles.section} ${styles.overview}`}>
    <div><h2>Không chỉ là<br/><em>một toà nhà.</em></h2><Link className={styles.primary} href="/tong-quan-tang/">Khám phá 6 tầng</Link></div>
    <div>{paragraphs.map(text => <p key={text}>{text}</p>)}</div>
  </section>;
}
