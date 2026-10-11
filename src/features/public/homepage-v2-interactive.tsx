"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ExpandingGallery, LayeredScrollStory } from "@mall/ui";
import { createRevealEngine, ScrollMotion } from "@mall/ui/motion";

import styles from "./homepage-v2.module.css";

export function Arrow() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>;
}

export function HomeScrollStory({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  return <>
    <ScrollMotion refreshKey="homepage-v2" revealSelector={`#main-content [data-ui-layered-surface] > section:not([aria-label]):not(#phan-khu):not(#gioi-thieu):not(.${styles.location})`}/>
    <HomeEditorialMotion/>
    <LayeredScrollStory className={styles.story}>
      <LayeredScrollStory.Hero>{hero}</LayeredScrollStory.Hero>
      <LayeredScrollStory.Surface>{children}</LayeredScrollStory.Surface>
    </LayeredScrollStory>
  </>;
}

function HomeEditorialMotion() {
  useLayoutEffect(() => {
    const root = document.querySelector("#main-content") ?? document;
    const hero = root.querySelector(`.${styles.hero}`);
    const heroTargets = hero?.querySelectorAll<HTMLElement>("[data-reveal]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
      heroTargets?.forEach(target => target.style.setProperty("transition", "none", "important"));
    }
    const editorialEngine = createRevealEngine({
      selector: `#gioi-thieu [data-reveal], .${styles.location} [data-reveal]`,
      rootMargin: "0px 0px -10% 0px",
    }).start(root);
    let heroEngine: ReturnType<typeof createRevealEngine> | null = null;
    let firstRevealFrame = 0;
    let secondRevealFrame = 0;
    heroTargets?.forEach(target => {
      if (reducedMotion) return;
      void window.getComputedStyle(target).opacity;
      target.style.removeProperty("transition");
    });
    if (hero && reducedMotion) {
      heroEngine = createRevealEngine({ selector: `.${styles.hero} [data-reveal]` }).start(root);
    } else if (hero) {
      firstRevealFrame = window.requestAnimationFrame(() => {
        secondRevealFrame = window.requestAnimationFrame(() => {
          heroEngine = createRevealEngine({
            selector: `.${styles.hero} [data-reveal]`,
            rootMargin: "0px 0px -10% 0px",
          }).start(root);
          heroEngine.revealVisible(root);
        });
      });
    }
    return () => {
      window.cancelAnimationFrame(firstRevealFrame);
      window.cancelAnimationFrame(secondRevealFrame);
      heroEngine?.destroy();
      editorialEngine.destroy();
    };
  }, []);

  return null;
}


const spaces = [
  { id: "retail", title: "Retail / Shophouse", description: "Không gian trưng bày và kinh doanh, tạo nhịp sống cho mặt tiền.", floor: 1 },
  { id: "office", title: "Văn phòng", description: "Môi trường chuyên nghiệp, linh hoạt cho doanh nghiệp phát triển lâu dài.", floor: 3 },
  { id: "cafe", title: "F&B", description: "Nhà hàng, café, bakery — những điểm hẹn cho trải nghiệm ẩm thực và gặp gỡ.", floor: 1 },
  { id: "services", title: "Dịch vụ", description: "Clinic, spa, giáo dục — không gian cho những dịch vụ cần sự riêng tư.", floor: 4 },
  { id: "entertainment", title: "Giải trí", description: "Định hướng giải trí, fitness, studio và rạp chiếu phim dự kiến.", floor: 5 },
  { id: "market", title: "Mini mart & Tiện ích", description: "Những dịch vụ thiết yếu dành cho cộng đồng xung quanh.", floor: 1 },
];

export function SpacesGallery({ assetBase }: { assetBase: string }) {
  return <ExpandingGallery className={styles.spacesGallery} aria-label="Các loại hình không gian kinh doanh" activeRatio={3}>
    {spaces.map(space => <ExpandingGallery.Item key={space.id} value={space.id} className={styles.spacePanel} aria-label={space.title}>
      <ExpandingGallery.Media><img src={`${assetBase}/images/home-v2/${space.id}.webp`} alt="" loading="lazy" decoding="async"/></ExpandingGallery.Media>
      <div className={styles.spaceLabel}>{space.title}<Arrow/></div>
      <ExpandingGallery.Content className={styles.spaceContent}><h3>{space.title}</h3><p>{space.description}</p><Link href={`/mat-bang/#tang-${space.floor}`} prefetch={false} className={styles.spaceLink}>Khám phá mặt bằng <Arrow/></Link></ExpandingGallery.Content>
    </ExpandingGallery.Item>)}
  </ExpandingGallery>;
}

const views = [
  { title: "Bối cảnh đô thị", path: "/images/le-grande-aerial-context.webp", caption: "Le Grande Centre bên vòng xoay Tượng đài 3 Cô Gái và Hồ Nước Ngọt." },
  { title: "Công trình thực tế", path: "/images/le-grande-aerial-close.webp", caption: "Góc nhìn cận cảnh công trình Le Grande Centre." },
  { title: "Phối cảnh kiến trúc", path: "/client-reference/canva/project-perspective.jpg", caption: "Phối cảnh minh họa kiến trúc và cảnh quan dự án." },
];

export function OverviewGallery({ assetBase }: { assetBase: string }) {
  const [selected, setSelected] = useState(0);
  return <div className={styles.overviewGallery}>
    <div className={styles.viewChoices} aria-label="Chọn góc nhìn dự án">{views.map((view, index) => <button key={view.title} aria-pressed={selected === index} aria-controls="project-view" onClick={() => setSelected(index)}><img src={`${assetBase}${view.path}`} alt="" loading="lazy" decoding="async"/><span>{view.title}</span></button>)}</div>
    <figure id="project-view"><img src={`${assetBase}${views[selected].path}`} alt={views[selected].caption} width="2400" height="1350" loading="lazy" decoding="async"/><figcaption aria-live="polite">{views[selected].caption}</figcaption></figure>
  </div>;
}
