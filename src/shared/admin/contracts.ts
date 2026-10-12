import type { B2BCommand, B2BData } from "./b2b-model";
import type { Floor, FloorConfiguration, Slot, SlotStatus, SpaceGroup } from "./space-model";
import type { StorageUsage } from "./storage-policy";
import { isWebsiteSettings, type WebsiteSettings } from "./website-settings";

export const LEAD_STATUSES = ["Mới", "Đang tư vấn", "Đã xử lý"] as const;
export type Lead = {
  id: string; name: string; initials: string; interest: string; floor: Floor;
  source: string; time: string; status: (typeof LEAD_STATUSES)[number]; note: string;
  companyId?: string; email?: string; phone?: string;
};
export type LeadInput = Omit<Lead, "id" | "initials" | "time">;
export type AdminSettings = { propertyName: string; contactEmail: string; contactPhone: string; defaultHoldHours: number; appointmentMinutes: number; appointmentLocation: string; website: WebsiteSettings };
export function isAdminSettings(value: unknown): value is AdminSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Record<string, unknown>;
  const bounded = (key: string, max: number, required = false) => typeof settings[key] === "string" && String(settings[key]).trim() === settings[key] && String(settings[key]).length <= max && (!required || String(settings[key]).length > 0);
  return bounded("propertyName", 120, true) && bounded("contactEmail", 254) && bounded("contactPhone", 32) && bounded("appointmentLocation", 160, true)
    && (!settings.contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settings.contactEmail)))
    && (!settings.contactPhone || /^[+\d().\s-]{6,32}$/.test(String(settings.contactPhone)))
    && Number.isInteger(settings.defaultHoldHours) && Number(settings.defaultHoldHours) >= 1 && Number(settings.defaultHoldHours) <= 720
    && Number.isInteger(settings.appointmentMinutes) && Number(settings.appointmentMinutes) >= 15 && Number(settings.appointmentMinutes) <= 240 && isWebsiteSettings(settings.website);
}
export type MediaItem = {
  id: string; name: string; kind: "Ảnh" | "Tài liệu" | "Video" | "Model 3D" | "Tài nguyên"; scope: string;
  size: string; url?: string; reference?: boolean; sizeBytes?: number; mimeType?: string; hasUploadedFile: boolean;
  projectAsset?: boolean; sourcePath?: string;
};
export type AdminSnapshot = B2BData & { revision: number; storage: StorageUsage | null; floors: FloorConfiguration[]; settings: AdminSettings; slots: Slot[]; groups: SpaceGroup[]; leads: Lead[]; media: MediaItem[] };
export type AdminCommand = B2BCommand
  | { type: "update-floor"; floor: Floor; purpose: string; publicTitle: string; publicDescription: string }
  | { type: "update-website-settings"; values: WebsiteSettings }
  | { type: "update-settings"; values: AdminSettings }
  | { type: "merge"; floor: Floor; slotIds: string[]; name: string }
  | { type: "split"; groupId: string }
  | { type: "update-slot"; slotId: string; status: SlotStatus; tenant: string; area?: number }
  | { type: "update-group"; groupId: string; name: string; status: SlotStatus }
  | { type: "save-lead"; leadId?: string; values: LeadInput }
  | { type: "link-media"; mediaId: string; scope: string }
  | { type: "rename-media"; mediaId: string; name: string }
  | { type: "delete-media"; mediaId: string };

// Authoritative state after each mutation. HTTP backends must authenticate,
// authorize and commit business invariants atomically. Browser demo is not auth.
export interface AdminRepository {
  readonly initialSnapshot: AdminSnapshot | null;
  read(): Promise<AdminSnapshot>;
  execute(command: AdminCommand): Promise<AdminSnapshot>;
  upload(files: File[], scope: string): Promise<AdminSnapshot>;
  dispose(): void;
}
