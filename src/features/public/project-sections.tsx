import type { ReactNode } from "react";
import Link from "next/link";
import { r2AssetBase } from "@/config/site";
import styles from "./canva-pages.module.css";
import { responsiveImageProps } from "./responsive-images";

type ProjectImage = { path: string; alt: string; caption: string };

export function ProjectHero({ title, description, image }: {
  title: ReactNode;
  description: string;
  image: ProjectImage;
}) {
  const assetBase = r2AssetBase;
  return <section className={styles.hero}>
    <div><h1>{title}</h1><p>{description}</p></div>
    <figure><img className={styles.heroImage} {...responsiveImageProps(image.path, assetBase, "(max-width: 700px) 100vw, (max-width: 1440px) 50vw, 720px")} alt={image.alt} decoding="async"/><figcaption>{image.caption}</figcaption></figure>
  </section>;
}

export function ProjectOverview({ paragraphs }: { paragraphs: readonly string[] }) {
  return <section className={`${styles.section} ${styles.overview}`}>
    <div><h2>Không chỉ là<br/><em>một toà nhà.</em></h2><Link className={styles.primary} href="/tong-quan-tang/">Khám phá 6 tầng</Link></div>
    <div>{paragraphs.map(text => <p key={text}>{text}</p>)}</div>
  </section>;
}
