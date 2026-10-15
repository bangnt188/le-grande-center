import { Building2, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./business-space-overview.module.css";

const METRICS = [
  { value: "06", label: "tầng thương mại" },
  { value: "12.400", label: "m² thương mại" },
  { value: "24/7", label: "Quản lí và bảo vệ" },
  { value: "01", label: "Khu vực giữ xe nội bộ" },
  { value: "100%", label: "khu chung có PCCC" },
] as const;

const AMENITIES = [
  {
    icon: "security",
    title: "An ninh & PCCC",
    description: "Hệ thống kiểm soát an ninh, camera và tiêu chuẩn PCCC được quản lý chặt chẽ.",
  },
  {
    icon: "common",
    title: "Khu vực chung",
    description: "Sảnh chính và hành lang được hoàn thiện với ngôn ngữ nhất quán, dễ định hướng thương hiệu.",
  },
  {
    icon: "experience",
    title: "Trải nghiệm",
    description: "Ánh sáng, cảnh quan và điểm dừng được cân nhắc để không gian mở rộng, phù hợp với nhịp sống đô thị mới.",
  },
] as const;

const AMENITY_ICONS = {
  security: ShieldCheck,
  common: Building2,
  experience: Sparkles,
} as const;

function AmenityIcon({ kind }: { kind: keyof typeof AMENITY_ICONS }) {
  const Icon = AMENITY_ICONS[kind];
  return <span className={styles.iconFrame} aria-hidden="true"><Icon size={48} strokeWidth={1.5}/></span>;
}

export function BusinessSpaceOverview() {
  return <section className={styles.overview} aria-labelledby="business-space-overview-title">
    <div className={styles.inner}>
      <p className={styles.eyebrow}>TÒA NHÀ &amp; TIỆN ÍCH</p>
      <h1 id="business-space-overview-title" className={styles.title}>
        <span className={styles.titleLine}>Không gian</span>
        <span className={`${styles.titleLine} ${styles.titleAccent}`}>Kinh Doanh</span>
      </h1>
      <dl className={styles.metrics}>
        {METRICS.map(metric => <div key={metric.value}>
          <dt>{metric.value}</dt>
          <dd>{metric.label}</dd>
        </div>)}
      </dl>
      <div className={styles.amenities}>
        {AMENITIES.map(amenity => <article className={styles.amenity} key={amenity.title}>
          <AmenityIcon kind={amenity.icon}/>
          <h2>{amenity.title}</h2>
          <p>{amenity.description}</p>
        </article>)}
      </div>
    </div>
  </section>;
}
