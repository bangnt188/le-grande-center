import { Badge } from "@mall/ui";
import { STATUS_CONFIG, type LeasingAvailability } from "./leasing-model";
import styles from "./leasing-availability-badge.module.css";

export function LeasingAvailabilityBadge({ availability, surface = "light" }: { availability: LeasingAvailability; surface?: "light" | "dark" }) {
  const config = STATUS_CONFIG[availability] ?? STATUS_CONFIG.available;
  const isAvailable = availability === "available";
  const darkClass = surface === "dark"
    ? isAvailable
      ? styles.availableOnDark
      : availability === "contact"
        ? styles.contactOnDark
        : undefined
    : undefined;

  return <span className={styles.status}>
    <Badge className={darkClass} tone={config.tone} aria-label={`Trạng thái: ${config.label}`}>{config.label}</Badge>
    {surface === "dark" && isAvailable && <span className={styles.availabilityLight} data-ui-effect="signal" aria-hidden="true"/>}
    <small>Trạng thái mô phỏng · chờ kết nối dữ liệu</small>
  </span>;
}
