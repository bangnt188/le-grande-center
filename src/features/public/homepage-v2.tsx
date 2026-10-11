import Link from "next/link";
import { siteUrl } from "@/config/site";
import { SiteFooter } from "./site-footer";
import { ADDRESS, LEASING_PHONES } from "./site-content";
import { BROCHURE_UNITS } from "./brochure-leasing";
import { HomeScrollStory, Arrow, SpacesGallery, OverviewGallery } from "./homepage-v2-interactive";
import { FloorShowcase } from "./floor-showcase";
import { SiteHeader } from "./site-header";
import { reveal, revealGroup } from "@mall/ui/motion";
import styles from "./homepage-v2.module.css";
const reasons = [
  { title: "Vị trí đắc địa", description: "Tọa lạc ngay trung tâm đô thị Sóc Trăng, thuận tiện kết nối các hoạt động thương mại, dịch vụ và dân cư trong khu vực." },
  { title: "Hệ sinh thái vững mạnh", description: "Quy tụ cộng đồng doanh nghiệp đa ngành, kiến tạo môi trường hợp tác, nơi mỗi đơn vị là một mắt xích trong chuỗi giá trị chung." },
  { title: "Đa dạng công năng", description: "Kiến trúc hiện đại, không gian mở thoáng đãng, thiết kế tối ưu hóa công năng sử dụng." },
  { title: "Quản lý chuyên nghiệp", description: "Hạ tầng và không gian vận hành được định hướng để doanh nghiệp tập trung phát triển trải nghiệm của riêng mình." },
  { title: "Tiềm năng dài hạn", description: "Một địa điểm kinh doanh gắn với nhịp phát triển đô thị và nhu cầu thương mại, dịch vụ của cộng đồng." },
  { title: "Thông tin minh bạch", description: "Tìm hiểu mặt bằng qua brochure dự án, hồ sơ hiện có và trao đổi trực tiếp với đội ngũ tư vấn." },
];
const featuredUnits = [1, 2, 3, 4].map(floor => BROCHURE_UNITS.find(unit => unit.floorId === floor)!);

export default function HomePageV2() {
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  const image = (path: string) => `${assetBase}${path}`;
  return <div className={styles.page} data-homepage-version="2">
    <SiteHeader/>
    <main id="main-content" tabIndex={-1}>
      <HomeScrollStory hero={<section className={styles.hero} aria-labelledby="home-title">
        <img className={styles.heroImage} src={image("/images/home-v2/hero.webp")} alt="Không gian thương mại với mặt tiền xanh và lối đi bộ" width="1842" height="854" fetchPriority="high"/>
        <div className={styles.heroInner} {...revealGroup({ stagger: 120, delayCap: 240 })}>
          <h1 id="home-title" {...reveal({ preset: "slide-left", duration: 3000 })}>LE GRANDE<br/>CENTRE</h1>
          <p {...reveal({ preset: "slide-left", duration: 3000 })}>Điểm đến thương mại đẳng cấp tại trung tâm đô thị Sóc Trăng, kết hợp không gian thương mại – dịch vụ – văn phòng hiện đại dành cho những thương hiệu đang tìm kiếm một địa điểm kinh doanh thực tế và giàu tiềm năng phát triển.</p>
          <div className={styles.heroActions} {...reveal({ preset: "slide-left", duration: 3000 })}><Link href="/mat-bang/" prefetch={false} className={styles.paperButton}>Xem mặt bằng <Arrow/></Link><Link href="/lien-he/" prefetch={false} className={styles.heroOutline}>Đặt lịch tham quan <Arrow/></Link></div>
          <dl className={styles.heroStats} {...revealGroup({ stagger: 100, delayCap: 200 })}><div {...reveal({ preset: "fade-up", duration: 3000 })}><dt>Tầng thương mại</dt><dd>06</dd><span>Retail, F&B, văn phòng & dịch vụ</span></div><div {...reveal({ preset: "fade-up", duration: 3000 })}><dt>Phân khu công năng</dt><dd>03</dd><span>Nhiều quy mô, nhiều mô hình</span></div><div {...reveal({ preset: "fade-up", duration: 3000 })}><dt>Mặt tiền</dt><dd>02</dd><span>Kết nối nhịp sống đô thị</span></div></dl>
        </div>
        <a href="#gioi-thieu" className={styles.scrollLink} aria-label="Cuộn tới giới thiệu dự án"><span>Khám phá</span><svg width="18" height="24" viewBox="0 0 18 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 2v18m-5-5 5 5 5-5"/></svg></a>
      </section>}>

      <section className={styles.film} aria-label="Phim giới thiệu dự án"><video controls playsInline preload="none" poster={image("/project-film-poster.webp")} width="960" height="540" aria-label="Phim giới thiệu Le Grande Centre"><source src={image("/project-film.mp4")} type="video/mp4"/>Trình duyệt không hỗ trợ video. <a href={image("/project-film.mp4")}>Mở phim dự án</a>.</video><span>Le Grande Centre · Phim giới thiệu dự án</span></section>

      <section id="gioi-thieu" className={`${styles.section} ${styles.introduction}`} aria-labelledby="introduction-title">
        <h2 id="introduction-title" {...reveal({ preset: "fade-up", duration: 1500 })}><em>Nhịp Thở <span>Mới</span> – Tầm Vóc <span>Mới</span></em></h2>
        <div className={styles.introGrid} {...revealGroup({ stagger: 120 })}>
          <figure {...reveal({ preset: "zoom-in", duration: 1500 })}>
            <img src={image("/images/home-v2/introduction.webp")} alt="Le Grande Centre và vòng xoay Tượng đài 3 Cô Gái" width="1121" height="631" loading="lazy" decoding="async"/>
          </figure>
          <div {...reveal({ preset: "lift-in", duration: 1500 })}>
            <p>Nằm tại vòng xoay Tượng đài 3 Cô Gái, Le Grande Centre được định hướng trở thành điểm đến thương mại, dịch vụ, văn phòng đa chức năng tại khu vực Sóc Trăng. Thay vì một địa điểm riêng lẻ, doanh nghiệp có cơ hội hoạt động trong một tổ hợp quy tụ nhiều nhu cầu: mua sắm, ẩm thực, làm việc và trải nghiệm.</p>
            <p>Chúng tôi tin rằng một mặt bằng phù hợp phải giúp thương hiệu được nhận diện rõ hơn, tiếp cận thuận tiện hơn và có nền tảng để phát triển lâu dài.</p>
            <Link href="/tong-quan/" className={styles.textLink} prefetch={false}>Tìm hiểu Le Grande Centre <Arrow/></Link>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.location}`} aria-labelledby="location-title">
        <h2 id="location-title" {...reveal({ preset: "lift-in", duration: 1500, intensity: "subtle" })}><em>Vị Trí <span>Chiến Lược</span></em></h2>
        <div className={styles.locationGrid} {...revealGroup({ stagger: 120, delayCap: 240 })}>
          <div>
            <p className={styles.locationLead} {...reveal({ preset: "slide-left", duration: 1500, intensity: "subtle" })}>Sóc Trăng đang bước vào một nhịp phát triển mới. Tại điểm giao của thương mại, dịch vụ và đời sống đô thị, một địa điểm thuận tiện tạo nên khác biệt.</p>
            <iframe className={styles.locationMap} {...reveal({ preset: "slide-left", duration: 1500, intensity: "subtle" })} title="Bản đồ vị trí Le Grande Centre" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3933.8266955678832!2d105.969214276063!3d9.610186390476178!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31a04d86b7d9a867%3A0x58da1a5e9f7000e3!2sLe%20Grande%20Centre!5e0!3m2!1sen!2s!4v1791624863663!5m2!1sen!2s" width="600" height="450" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>
            <address>{ADDRESS}</address>
            <a href="https://maps.app.goo.gl/psjcjBjqCCa2UzwRA" target="_blank" rel="noopener noreferrer" className={styles.textLink}>Xem vị trí trên bản đồ <Arrow/></a>
          </div>
          <div className={styles.locationInformation} {...reveal({ preset: "slide-right", duration: 1500, intensity: "subtle" })}>
            <img src={image("/images/le-grande-aerial-context.webp")} alt="Công trình và vòng xoay Tượng đài 3 Cô Gái trong bối cảnh đô thị Sóc Trăng" width="2400" height="1350" loading="lazy" decoding="async"/>
            <h3>Một địa điểm.<br/>Nhiều kết nối.</h3>
            <p>Le Grande Centre kết nối vòng xoay Tượng đài 3 Cô Gái, khu vực Hồ Nước Ngọt và các trục giao thông của đô thị Sóc Trăng.</p>
            <img className={styles.locationSmallImage} src={image("/images/le-grande-aerial-close.webp")} alt="Le Grande Centre và không gian xanh phía sau công trình" width="2400" height="1350" loading="lazy" decoding="async"/>
          </div>
        </div>
      </section>

      <section id="phan-khu" className={`${styles.section} ${styles.floors}`} aria-labelledby="floors-title"><div className={styles.sectionHeading}><h2 id="floors-title">Sáu tầng.<br/><em>Nhiều cơ hội kinh doanh.</em></h2></div><FloorShowcase assetBase={assetBase}/></section>

      <section id="khong-gian" className={`${styles.section} ${styles.spaces}`} aria-labelledby="spaces-title"><div className={styles.sectionHeading}><div><h2 id="spaces-title"><em>Đa dạng loại hình,<br/>linh hoạt lựa chọn.</em></h2><p>Định hướng tích hợp nhiều tiện ích trong cùng một không gian, từ văn phòng hiện đại đến chuỗi F&B, retail, dịch vụ và giải trí.</p></div></div><SpacesGallery assetBase={assetBase}/></section>

      <section className={styles.leasing} aria-labelledby="leasing-title"><div className={styles.section}><div className={styles.sectionHeading}><h2 id="leasing-title">Tìm không gian phù hợp<br/><em>cho doanh nghiệp của bạn.</em></h2><Link href="/mat-bang/" className={styles.textLink} prefetch={false}>Khám phá tất cả mặt bằng <Arrow/></Link></div><div className={styles.unitGrid}>{featuredUnits.map(unit => <Link key={unit.id} href={`/mat-bang/${unit.id}/`} className={styles.unitCard} prefetch={false}><div className={styles.unitImage}><img src={image(unit.floorId <= 2 ? "/images/home-v2/facade-detail.jpg" : "/images/home-v2/upper-detail.jpg")} alt={`Phối cảnh minh họa khu ${unit.floorId <= 2 ? "shophouse" : "dịch vụ và văn phòng"}`} width="600" height="400" loading="lazy" decoding="async"/><span>Tầng {unit.floorId}</span></div><div className={styles.unitContent}><h3>{unit.id} <Arrow/></h3><p>{unit.types.join(" · ")}</p><dl><div><dt>Diện tích</dt><dd>{unit.area.toLocaleString("vi-VN")} m²</dd></div>{unit.dimensions && <div><dt>Kích thước</dt><dd>{unit.dimensions.width} × {unit.dimensions.depth} m</dd></div>}</dl><span className={styles.unitLink}>Xem chi tiết mặt bằng</span></div></Link>)}</div></div></section>

      <section className={`${styles.section} ${styles.overview}`} aria-labelledby="overview-title"><div className={styles.sectionHeading}><h2 id="overview-title">Tổng quan<br/><em>Le Grande Centre.</em></h2><Link href="/tong-quan/" className={styles.textLink} prefetch={false}>Tìm hiểu dự án <Arrow/></Link></div><OverviewGallery assetBase={assetBase}/><div className={styles.mosaic}><figure><img src={image("/images/home-v2/facade-detail.jpg")} alt="Phối cảnh shophouse và mặt tiền thương mại" width="900" height="600" loading="lazy" decoding="async"/><figcaption>Không gian cho thương hiệu</figcaption></figure><figure><img src={image("/images/home-v2/upper-detail.jpg")} alt="Phối cảnh không gian tầng trên Le Grande Centre" width="900" height="600" loading="lazy" decoding="async"/><figcaption>Những kết nối mới</figcaption></figure><figure><img src={image("/images/home-v2/architecture-detail.jpg")} alt="Chi tiết phối cảnh kiến trúc Le Grande Centre" width="900" height="600" loading="lazy" decoding="async"/><figcaption>Một tầm nhìn dài hạn</figcaption></figure></div></section>

      <section id="ly-do-lua-chon" className={styles.reasons} aria-labelledby="reasons-title"><img className={styles.reasonsImage} src={image("/images/home-v2/reasons-background.webp")} alt="" width="1147" height="488" loading="lazy" decoding="async"/><div className={styles.section}><h2 id="reasons-title"><em>Tại Sao Chọn <span>Le Grande Centre?</span></em></h2><p className={styles.reasonsIntro}>Một nơi để kinh doanh. Một nền tảng để cùng phát triển.</p><div className={styles.reasonGrid}>{reasons.map(reason => <article key={reason.title}><h3><em>{reason.title}</em></h3><p>{reason.description}</p></article>)}</div></div></section>

      <section className={styles.contact} aria-labelledby="contact-title"><div><h2 id="contact-title"><em>Đặt lịch xem mặt bằng<br/>thực tế.</em></h2><p>Mỗi doanh nghiệp có một nhu cầu khác nhau.<br/>Cùng tìm không gian phù hợp với bạn.</p><div className={styles.contactActions}><Link href="/lien-he/" className={styles.paperButton} prefetch={false}>Liên hệ tư vấn <Arrow/></Link><a href={LEASING_PHONES[0].href}>Hotline: {LEASING_PHONES[0].label}</a></div></div></section>
      </HomeScrollStory>
    </main>
    <SiteFooter/>
  </div>;
}
