import { ADDRESS, EMAIL, LEASING_PHONES, MANAGEMENT_PHONE } from "./site-content";
import { ContactForm } from "@/features/contact/contact-form";
import { BROCHURE_UNITS } from "./brochure-leasing";
import styles from "./project-contact.module.css";

export function ProjectContact() {
  return <section className={styles.contact}><div className={styles.information}><h1>Thông tin rõ ràng.<br/><em>Trao đổi thực tế.</em></h1><dl className={styles.contactList}>
    <div><dt>Hotline cho thuê</dt><dd>{LEASING_PHONES.map(phone => <a key={phone.href} href={phone.href}>{phone.label}</a>)}</dd></div>
    <div><dt>Email</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div>
    <div><dt>Địa chỉ</dt><dd><address>{ADDRESS}</address><a className={styles.mapLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`} target="_blank" rel="noopener noreferrer">Xem vị trí trên bản đồ</a></dd></div>
    <div><dt>Ban quản lý dự án</dt><dd><a href={MANAGEMENT_PHONE.href}>{MANAGEMENT_PHONE.label}</a><small>Hỗ trợ vận hành & quản lý</small></dd></div>
  </dl></div><ContactForm visitPhone={LEASING_PHONES[0].href} units={BROCHURE_UNITS}/></section>;
}
