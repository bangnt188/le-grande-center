import { Badge } from "@mall/ui";
import type { LeasingAvailability } from "./leasing-model";
import styles from "./leasing-availability-badge.module.css";

export function LeasingAvailabilityBadge({ availability, surface = "light" }: { availability: LeasingAvailability; surface?: "light" | "dark" }) {
  const available = availability === "available";
  const label = available ? "Còn trống" : "Đã thuê";
  return <span className={styles.status}>
    <Badge className={surface === "dark" && available ? styles.availableOnDark : undefined} tone={available ? "success" : "error"} aria-label={`Trạng thái mô phỏng: ${label}`}>{label}</Badge>
    {surface === "dark" && available && <span className={styles.availabilityLight} data-ui-effect="signal" aria-hidden="true"/>}
    <small>Trạng thái mô phỏng · chờ kết nối dữ liệu</small>
  </span>;
}
