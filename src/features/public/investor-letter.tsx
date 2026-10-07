import { siteUrl } from "@/config/site";
import styles from "./investor-letter.module.css";

export function InvestorLetter({ paragraphs, backgroundPath }: { paragraphs: readonly string[]; backgroundPath: string }) {
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  return <section id="letter" className={styles.letter} aria-labelledby="investor-letter-heading">
    <img className={styles.backdrop} src={`${assetBase}${backgroundPath}`} alt="" aria-hidden="true" loading="lazy"/>
    <div className={styles.inner}>
      <p className={styles.label}>Thư Ngỏ Từ Chủ Đầu Tư</p>
      <h2 id="investor-letter-heading">Lời Cam Kết Của <em>Chúng Tôi</em><br/>Với <em>Đối Tác</em></h2>
      <div className={styles.divider} aria-hidden="true"><span/><svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 10 5 5 10 0 5Z" fill="currentColor"/></svg><span/></div>
      <blockquote className={styles.quotes}>{paragraphs.map(text => <p key={text}>“{text.includes("Le Grande Centre") ? <>{text.slice(0, text.indexOf("Le Grande Centre"))}<strong>Le Grande Centre</strong>{text.slice(text.indexOf("Le Grande Centre") + "Le Grande Centre".length)}</> : text}”</p>)}</blockquote>
      <div className={styles.signature}>
        <strong>Ban Lãnh Đạo Dự Án</strong>
        <span>LE GRANDE CENTRE - SÓC TRĂNG</span>
      </div>
    </div>
  </section>;
}
