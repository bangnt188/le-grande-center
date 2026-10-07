import Link from "next/link";
import { SitePage } from "@/features/public/site-page";
import { PUBLIC_FLOORS } from "@/features/public/site-content";
import styles from "@/features/public/site-shell.module.css";

export const metadata = { title: "Tổng quan từng tầng" };
export default function FloorsPage() {
  return <SitePage active="/tong-quan-tang/" title="Sáu tầng. Những không gian kết nối.">
    <p className={styles.intro}>Khám phá sáu tầng thương mại, dịch vụ và giải trí. Tìm không gian phù hợp cho thương hiệu của bạn.</p>
    {PUBLIC_FLOORS.map(item => <section key={item.floor} id={`tang-${item.floor}`} className={styles.floor}><span>Tầng {item.floor}</span><div><h2>{item.title}</h2><p>{item.description}</p><Link className={styles.link} href={`/mat-bang/#tang-${item.floor}`}>Tìm hiểu mặt bằng tầng {item.floor}</Link></div></section>)}
    <Link href="/kham-pha/" prefetch={false} className={styles.primary}>Khám phá công trình 3D</Link>
  </SitePage>;
}
