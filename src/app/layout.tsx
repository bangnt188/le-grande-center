import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Cormorant_Garamond, Playfair_Display } from "next/font/google";
import "@mall/ui/styles";
import "./globals.css";
import { isIndexable, siteUrl } from "@/config/site";

const interfaceFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const displayFont = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  variable: "--font-playfair-display",
  display: "swap",
});

const editorialFont = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  variable: "--font-cormorant-garamond",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Le Grande Center | Trung tâm thương mại",
    template: "%s | Le Grande Center",
  },
  description: "Khám phá Le Grande Centre: shophouse, dịch vụ, văn phòng và không gian giải trí tại Sóc Trăng. Xem kiến trúc 3D và liên hệ tư vấn mặt bằng.",
  robots: { index: isIndexable, follow: isIndexable },
  icons: { icon: new URL("client-reference/legacy/icon.png", siteUrl) },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002116",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body
        className={[interfaceFont.variable, displayFont.variable, editorialFont.variable].join(" ")}
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
