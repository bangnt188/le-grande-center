import type { B2BCommand, B2BData } from "./b2b-model";
import type { Floor, Slot, SpaceGroup } from "./space-model";
import type { StorageUsage } from "./storage-policy";

export type Lead = {
  id: string; name: string; initials: string; interest: string; floor: Floor;
  source: string; time: string; status: string; note: string;
};
export type MediaItem = {
  id: string; name: string; kind: "Ảnh" | "Tài liệu"; scope: string;
  size: string; url?: string; reference?: boolean;
};
export type AdminSnapshot = B2BData & { revision: number; storage: StorageUsage | null; slots: Slot[]; groups: SpaceGroup[]; leads: Lead[]; media: MediaItem[] };
export type AdminCommand = B2BCommand
  | { type: "merge"; floor: Floor; slotIds: string[]; name: string }
  | { type: "split"; groupId: string }
  | { type: "update-slot"; slotId: string; status: string; tenant: string }
  | { type: "update-group"; groupId: string; name: string; status: string }
  | { type: "update-lead"; leadId: string; status: string; note: string }
  | { type: "link-media"; mediaId: string; scope: string };

// Returns authoritative state after each mutation. A backend must authenticate
// and authorize every operation, and merge/split must commit atomically.
export interface AdminRepository {
  readonly initialSnapshot: AdminSnapshot | null;
  read(): Promise<AdminSnapshot>;
  execute(command: AdminCommand): Promise<AdminSnapshot>;
  upload(files: File[], scope: string): Promise<AdminSnapshot>;
  /** Demo-only preview. Never exposed by the authenticated HTTP repository. */
  previewStorage?(usedBytes: number): Promise<AdminSnapshot>;
  dispose(): void;
}
