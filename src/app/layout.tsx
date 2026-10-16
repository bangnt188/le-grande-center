import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "@mall/ui/styles";
import "./globals.css";
import { isIndexable, neonMediaUrl, siteUrl } from "@/config/site";

const interfaceFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Le Grande Centre | Trung tâm thương mại",
    template: "%s | Le Grande Centre",
  },
  description: "Khám phá Le Grande Centre: shophouse, dịch vụ, văn phòng và không gian giải trí tại Sóc Trăng. Xem thông tin dự án và liên hệ tư vấn mặt bằng.",
  robots: { index: isIndexable, follow: isIndexable },
  icons: { icon: neonMediaUrl("/client-reference/legacy/icon.png") },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002116",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-ui-scroll="smooth" data-ui-motion-policy="respect">
      <body
        className={interfaceFont.variable}
        data-ui-root
        data-ui-theme="shopping-mall"
        data-ui-scheme="dark"
      >
        <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
        {children}
      </body>
    </html>
  );
}
