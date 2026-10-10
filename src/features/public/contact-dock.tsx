"use client";

import { useEffect, useRef, useState } from "react";
import { LEASING_PHONES } from "./site-content";
import styles from "./contact-dock.module.css";

const phone = LEASING_PHONES[0];
const zaloHref = `https://zalo.me/${phone.href.slice(4)}`;

export function ContactDock() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(window.matchMedia("(min-width: 601px)").matches);
  }, []);

  return <nav className={styles.dock} data-open={open} data-ui-theme="shopping-mall" data-ui-scheme="light" aria-label="Liên hệ nhanh" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus();
    }
  }}>
    {open && <div className={styles.actions} id="public-contact-actions">
      <a className={`${styles.action} ${styles.zalo}`} href={zaloHref} target="_blank" rel="noopener noreferrer" aria-label={`Liên hệ qua Zalo ${phone.label}`}>
        <span className={styles.zaloMark} aria-hidden="true">Zalo</span>
        <span className={styles.label}>Zalo</span>
      </a>
      <a className={`${styles.action} ${styles.phone}`} href={phone.href} aria-label={`Gọi điện tư vấn ${phone.label}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.36 2.3.55 3.6.55a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.19 2.48.55 3.6a1 1 0 0 1-.25 1z"/></svg>
        <span className={styles.label}>{phone.label}</span>
      </a>
    </div>}
    <button ref={toggle} type="button" className={styles.toggle} aria-expanded={open} aria-controls={open ? "public-contact-actions" : undefined} aria-label={open ? "Thu gọn liên hệ nhanh" : "Mở liên hệ nhanh"} onClick={() => setOpen(current => !current)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{open ? <path d="m6 6 12 12M18 6 6 18"/> : <path d="M12 5v14M5 12h14"/>}</svg>
    </button>
  </nav>;
}
