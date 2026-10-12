"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useChapterScrollMotion } from "@mall/ui/motion";

import { PROGRAMS } from "./site-content";
import styles from "./business-space-scroll-story.module.css";
import { useWebsiteSettings } from "./website-settings";
const SCENES = [
  { layout: "asymmetric", images: ["retail.webp", "market.webp", "hero.webp"] },
  { layout: "mirrored", images: ["office.webp", "services.webp", "upper-detail.jpg"] },
  { layout: "panoramic", images: ["entertainment.webp", "cafe.webp", "architecture-detail.jpg"] },
  { layout: "grounded", images: ["cafe.webp", "market.webp", "facade-detail.jpg"] },
] as const;

type Scene = (typeof SCENES)[number];

const LAYOUT_CLASS = {
  asymmetric: styles.layoutAsymmetric,
  mirrored: styles.layoutMirrored,
  panoramic: styles.layoutPanoramic,
  grounded: styles.layoutGrounded,
} as const;

const TILE_CLASS = [styles.feature, styles.detailTop, styles.detailBottom] as const;

function floorRange(floors: readonly number[]) {
  return floors.map(floor => String(floor).padStart(2, "0")).join("–");
}

function MosaicTiles({ assetBase, scene, eager = false }: { assetBase: string; scene: Scene; eager?: boolean }) {
  return <div className={`${styles.mosaicGrid} ${LAYOUT_CLASS[scene.layout]}`}>
    {scene.images.map((image, index) => <figure
      key={image}
      className={`${styles.tile} ${TILE_CLASS[index] ?? styles.detailBottom}`}
      data-ui-chapter-tile
    >
      <img
        data-ui-chapter-media
        src={`${assetBase}/images/home-v2/${image}`}
        alt=""
        width={1600}
        height={900}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </figure>)}
  </div>;
}

export function BusinessSpaceScrollStory({ assetBase }: { assetBase: string }) {
  const { floorContent } = useWebsiteSettings();
  const storyRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeProgram = PROGRAMS[active] ?? PROGRAMS[0];
  useChapterScrollMotion(storyRef, setActive);

  if (!activeProgram) return null;

  return <div ref={storyRef} className={styles.story} data-ui-chapter-story role="region" aria-label="Không gian kinh doanh theo tầng">
    <div className={styles.visualColumn}>
      <div className={styles.visual}>
        <div className={styles.visualHeader}>Le Grande Centre</div>
        <div className={styles.mosaic} aria-hidden="true">
          {SCENES.map((scene, sceneIndex) => <div
            key={scene.layout}
            className={styles.scene}
            data-ui-chapter-scene={sceneIndex}
            data-ui-active={sceneIndex === active}
            aria-hidden={sceneIndex !== active}
          >
            <MosaicTiles assetBase={assetBase} scene={scene} eager={sceneIndex === 0} />
          </div>)}
        </div>
        <div className={styles.visualFooter} aria-live="polite" aria-atomic="true">
          <span className={styles.currentFloors}>Tầng {floorRange(activeProgram.floors)}</span>
        </div>
        <div className={styles.progressTrack} aria-hidden="true"><span data-ui-chapter-progress /></div>
      </div>
    </div>

    <div className={styles.chapters}>
      {PROGRAMS.map((program, index) => {
        const scene = SCENES[index];
        if (!scene) return null;
        const floorTitles = [...new Set(program.floors.map(floor => floorContent.find(item => item.number === floor)?.publicTitle).filter((title): title is string => Boolean(title)))];
        return <article
          key={program.title}
          id={`business-program-${index + 1}`}
          className={styles.chapter}
          data-ui-chapter
          data-ui-active={index === active}
          aria-labelledby={`business-program-title-${index + 1}`}
        >
          <div className={styles.chapterMosaic} aria-hidden="true">
            <MosaicTiles assetBase={assetBase} scene={scene} />
          </div>
          <div className={styles.chapterHeadingRow}>
            <h2 id={`business-program-title-${index + 1}`}>{floorTitles.join(" · ")}</h2>
            <span className={styles.chapterFloor}>Tầng {floorRange(program.floors)}</span>
          </div>
          <p className={styles.description}>{program.floors.map(floor => floorContent.find(item => item.number === floor)?.publicDescription).filter(Boolean).join(" ")}</p>
          <div className={styles.floorLinks}>
            {program.floors.map(floor => <Link key={floor} id={`tang-${floor}`} href={`/mat-bang/#tang-${floor}`} className={styles.floorLink} data-ui-interaction="colors">
              Tìm hiểu mặt bằng tầng {floor}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>)}
          </div>
        </article>;
      })}
    </div>
  </div>;
}
