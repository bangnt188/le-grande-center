import type { Metadata, Viewport } from "next";
import "@mall/ui/styles";
import "./globals.css";
import { isIndexable, siteUrl } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Le Grande Center | Trung tâm thương mại",
    template: "%s | Le Grande Center",
  },
  description: "Thông tin chính thức về Le Grande Center sẽ được cập nhật tại đây.",
  robots: { index: isIndexable, follow: isIndexable },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002116",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body data-ui-root data-ui-theme="shopping-mall" data-ui-scheme="dark">
        <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
        {children}
      </body>
    </html>
  );
}
