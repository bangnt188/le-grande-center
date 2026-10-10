export const PUBLIC_NAVIGATION = [
  { href: "/", label: "Trang chủ" },
  { href: "/mat-bang/", label: "Mặt bằng" },
  { href: "/tong-quan-tang/", label: "Không gian kinh doanh" },
  { href: "/tong-quan/", label: "Le Grande Centre" },
  { href: "/lien-he/", label: "Đặt lịch tham quan" },
];

// Descriptive programme from the existing project presentation, not live inventory.
export const PROGRAMS = [
  { floors: [1, 2], title: "Shophouse thương mại", description: "Không gian thương mại tầng 1–2 được giới thiệu theo mô hình shophouse thông tầng (duplex)." },
  { floors: [3, 4], title: "Dịch vụ – văn phòng", description: "Tầng 3–4 dành cho công năng dịch vụ và văn phòng theo giới thiệu dự án." },
  { floors: [5], title: "Giải trí", description: "Không gian giải trí, gồm phương án rạp chiếu phim dự kiến theo hồ sơ dự án." },
  { floors: [6], title: "Dịch vụ ngoài trời – sự kiện", description: "Tầng 6 được định hướng cho dịch vụ ngoài trời và sự kiện (dự kiến)." },
];
export const PUBLIC_FLOORS = [1, 2, 3, 4, 5, 6].map(floor => ({ floor, ...PROGRAMS.find(program => program.floors.includes(floor))! }));
export const ADDRESS = "18 Nguyễn Chí Thanh, Khu vực 3, Phường Sóc Trăng, TP. Cần Thơ";
export const EMAIL = "ntmcongty@gmail.com";
export const PHONE = "0973 879 563";
export const LEASING_PHONES = [
  { label: PHONE, href: "tel:0973879563" },
  { label: "0944 634 243", href: "tel:0944634243" },
];
export const MANAGEMENT_PHONE = { label: "0931 060 768", href: "tel:0931060768" };
