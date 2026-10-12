import test from "node:test";
import assert from "node:assert/strict";
import { tenantRecords } from "../src/features/admin/tenant-records";
import type { Company, Lease } from "../src/shared/admin/b2b-model";
import type { Slot } from "../src/shared/admin/space-model";

test("tenant register uses lease identity, deduplicates slots and keeps manual occupants unregistered", () => {
  const company: Company = { id: "company-1", name: "Same name", initials: "SN", industry: "Retail", brand: "", contact: "", email: "", phone: "", owner: "", note: "" };
  const slot: Slot = { id: "slot-1", floor: 1, code: "B1", order: 1, side: "west", area: 164, width: 1, status: "Đang thuê", tenant: "Same name" };
  const lease: Lease = { id: "lease-1", companyId: company.id, floor: 1, slotIds: [slot.id], area: slot.area, start: "2026-01-01", end: "2027-01-01", status: "executed", rentNote: "", documentName: "Contract.pdf" };
  const manual = { ...slot, id: "slot-2", code: "B2", order: 2 };
  const unnamed = { ...slot, id: "slot-3", code: "B3", order: 3, tenant: "" };
  const vacant: Slot = { ...slot, id: "slot-4", code: "B4", order: 4, status: "Trống", tenant: "Same name" };
  const rows = tenantRecords({ companies: [company, { ...company, id: "no-lease" }], leases: [lease, { ...lease, id: "lease-2" }], slots: [slot, manual, unnamed, vacant] });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, company.id);
  assert.deepEqual(rows[0].slots.map(item => item.id), [slot.id]);
  assert.equal(rows[0].leases, "lease-1, lease-2");
  assert.equal(rows[1].id, "manual:slot-2");
  assert.equal(rows[1].name, company.name);
  assert.equal(rows[1].leases, "—");
  assert.match(rows[1].label, /chưa có hồ sơ thuê/);
  assert.equal(rows[2].name, "Chưa ghi tên bên thuê");
  assert.ok(rows.every(row => !row.slots.some(item => item.id === vacant.id)));
});
