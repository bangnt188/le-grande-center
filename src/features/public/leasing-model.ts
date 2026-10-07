// Public presentation data only. This contract grants no inventory mutation rights.
export type PlanShape = Readonly<{
  x: number; y: number; width: number; height: number;
  polygon?: string;
  labelPosition?: Readonly<{ x: number; y: number }>;
}>;
export type LeasingFloor = Readonly<{
  id: number; label: string; description: string; sourcePage: number;
  sharedAreas: readonly (PlanShape & { label: string })[];
}>;
export type LeasingUnit = Readonly<{
  id: string; floorId: number; area: number; types: readonly string[];
  dimensions?: Readonly<{ width: number; depth: number }>;
  note?: string;
  plan: PlanShape;
}>;
export type AreaFilter = "" | "small" | "medium" | "large";

export function matchesArea(area: number, filter: AreaFilter) {
  switch (filter) {
    case "small": return area < 100;
    case "medium": return area >= 100 && area <= 150;
    case "large": return area > 150;
    default: return true;
  }
}
