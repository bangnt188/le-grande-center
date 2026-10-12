import type { WebsiteSettings } from "./website-settings";
export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  logoMediaId: "project:/client-reference/legacy/logo-without-text.png", email: "ntmcongty@gmail.com", hotline: "0973 879 563", secondaryPhone: "0944 634 243", managementPhone: "0931 060 768", address: "18 Nguyễn Chí Thanh, Khu vực 3, Phường Sóc Trăng, TP. Cần Thơ", zaloUrl: "https://zalo.me/0973879563",
};
export function telephoneHref(value: string) { return "tel:" + value.replace(/[^+\d]/g, ""); }
