import type { FloorConfiguration, SlotStatus } from "../admin/space-model";
import type { WebsiteSettings } from "../admin/website-settings";
export type PublicWebsite = { website: WebsiteSettings; logoUrl: string | null; floors: Pick<FloorConfiguration, "number" | "publicTitle" | "publicDescription">[]; units: { id: string; code: string; floor: number; area: number; status: SlotStatus }[] };
export type ContactSubmission = { intent: "consultation" | "visit" | "callback"; name: string; company: string; phone: string; email: string; business: string; area: string; timing: string; space: string; note: string; consent: boolean; unitId?: string; visitDate?: string; visitTime?: string; scope?: string };
