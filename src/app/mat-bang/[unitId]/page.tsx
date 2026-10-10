import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteUrl } from "@/config/site";
import { BROCHURE_FLOORS, BROCHURE_UNITS } from "@/features/public/brochure-leasing";
import { PublicPageLayout } from "@/features/public/public-page-layout";
import { LeasingUnitDetail } from "@/features/public/leasing-unit-detail";
import styles from "@/features/public/leasing-unit-detail.module.css";

type Props = { params: Promise<{ unitId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return BROCHURE_UNITS.map(unit => ({ unitId: unit.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { unitId } = await params;
  const unit = BROCHURE_UNITS.find(item => item.id === unitId);
  if (!unit) notFound();
  const title = `Mặt bằng ${unit.id} · Tầng ${unit.floorId}`;
  const description = `Mặt bằng ${unit.id}, tầng ${unit.floorId}, diện tích ${unit.area.toLocaleString("vi-VN")} m² theo brochure Le Grande Centre. Xem sơ đồ vị trí, thông tin tham khảo và liên hệ tư vấn.`;
  const url = new URL(`mat-bang/${encodeURIComponent(unit.id)}/`, siteUrl).href;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website", locale: "vi_VN", siteName: "Le Grande Centre" } };
}

export default async function UnitPage({ params }: Props) {
  const { unitId } = await params;
  const unit = BROCHURE_UNITS.find(item => item.id === unitId);
  const floor = BROCHURE_FLOORS.find(item => item.id === unit?.floorId);
  if (!unit || !floor) notFound();
  return <PublicPageLayout active="/mat-bang/" variant="project" className={styles.frame} colorScheme="light">
    <LeasingUnitDetail unit={unit} floor={floor} floorUnits={BROCHURE_UNITS.filter(item => item.floorId === floor.id)}/>
  </PublicPageLayout>;
}
