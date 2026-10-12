"use client";

import { useWebsiteSettings, WebsiteLeasingPhones } from "./website-settings";
import { telephoneHref } from "@/shared/admin/website-defaults";
import { ContactForm } from "@/features/contact/contact-form";
import { BROCHURE_UNITS } from "./brochure-leasing";
import styles from "./project-contact.module.css";

export function ProjectContact() {
  const { settings } = useWebsiteSettings();
  return <section className={styles.contact}><div className={styles.information}><h1>Thông tin rõ ràng.<br/><em>Trao đổi thực tế.</em></h1><dl className={styles.contactList}>
    <div><dt>Hotline cho thuê</dt><dd><WebsiteLeasingPhones/></dd></div>
    <div><dt>Email</dt><dd><a href={`mailto:${settings.email}`}>{settings.email}</a></dd></div>
    <div><dt>Địa chỉ</dt><dd><address>{settings.address}</address><a className={styles.mapLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" rel="noopener noreferrer">Xem vị trí trên bản đồ</a></dd></div>
    {settings.managementPhone && <div><dt>Ban quản lý dự án</dt><dd><a href={telephoneHref(settings.managementPhone)}>{settings.managementPhone}</a><small>Hỗ trợ vận hành & quản lý</small></dd></div>}
  </dl></div><ContactForm visitPhone={telephoneHref(settings.hotline)} units={BROCHURE_UNITS}/></section>;
}
