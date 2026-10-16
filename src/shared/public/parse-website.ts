import { FLOORS, isSlotStatus } from "../admin/space-model";
import type { Floor } from "../admin/space-model";
import type { PublicWebsite } from "./contracts";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid public website projection.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length > 10_000) throw new Error("Invalid public website text.");
  return value;
}
function floor(value: unknown): Floor {
  const number = FLOORS.find(number => number === value);
  if (number === undefined) throw new Error("Invalid public website floor.");
  return number;
}

/** Copy only the public contract; never embed extra API fields in prerendered pages. */
export function parsePublicWebsite(value: unknown): PublicWebsite {
  const data = object(value), website = object(data.website);
  if (!Array.isArray(data.floors) || data.floors.length > 6 || !Array.isArray(data.units) || data.units.length > 5000) {
    throw new Error("Invalid public website catalog.");
  }
  const logoUrl = data.logoUrl === null ? null : text(data.logoUrl);
  if (logoUrl !== null && new URL(logoUrl).protocol !== "https:") throw new Error("Invalid public logo URL.");
  return {
    website: {
      logoMediaId: text(website.logoMediaId), email: text(website.email), hotline: text(website.hotline),
      secondaryPhone: text(website.secondaryPhone), managementPhone: text(website.managementPhone),
      address: text(website.address), zaloUrl: text(website.zaloUrl),
    },
    logoUrl,
    floors: data.floors.map(value => {
      const row = object(value);
      return { number: floor(row.number), publicTitle: text(row.publicTitle), publicDescription: text(row.publicDescription) };
    }),
    units: data.units.map(value => {
      const row = object(value);
      if (typeof row.area !== "number" || !Number.isFinite(row.area) || row.area < 0 || !isSlotStatus(row.status)) throw new Error("Invalid public unit.");
      return { id: text(row.id), code: text(row.code), floor: floor(row.floor), area: row.area, status: row.status };
    }),
  };
}
