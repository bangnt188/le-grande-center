import "server-only";
import { cache } from "react";
import { readPublicWebsite } from "./public";
import { BROCHURE_FLOORS, BROCHURE_UNITS } from "@/features/public/brochure-leasing";

export const readPublicLeasing = cache(async () => {
  const publicData = await readPublicWebsite();
  const units = publicData.units.map(record => {
    const brochure = BROCHURE_UNITS.find(item => item.id === record.code && item.floorId === record.floor);
    if (!brochure) throw new Error("Published inventory has no approved brochure geometry.");
    return { ...brochure, area: record.area, availability: record.status === "Đang thuê" ? "leased" as const : "available" as const };
  });
  const floors = publicData.floors.map(record => {
    const brochure = BROCHURE_FLOORS.find(item => item.id === record.number);
    if (!brochure) throw new Error("Published floor has no approved brochure reference.");
    return { ...brochure, label: record.publicTitle, description: record.publicDescription };
  });
  return { units, floors };
});
