import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesArea,
  matchesStatus,
  STATUS_CONFIG,
  STATUS_OPTIONS,
  type AreaFilter,
  type LeasingAvailability,
  type LeasingUnit,
  type StatusFilter,
} from "../src/features/public/leasing-model";

const sampleUnits: readonly LeasingUnit[] = [
  { id: "A.1", floorId: 1, area: 115, types: ["Shophouse"], availability: "available", orientation: "Đông", plan: { x: 0, y: 0, width: 10, height: 10 } },
  { id: "A.2", floorId: 1, area: 85, types: ["Shophouse"], availability: "contact", orientation: "Đông", plan: { x: 10, y: 0, width: 10, height: 10 } },
  { id: "A.3", floorId: 1, area: 160, types: ["Shophouse"], availability: "leased", orientation: "Đông", plan: { x: 20, y: 0, width: 10, height: 10 } },
  { id: "3.1", floorId: 3, area: 90, types: ["Dịch vụ"], availability: "available", orientation: "Tây", plan: { x: 0, y: 0, width: 10, height: 10 } },
  { id: "3.2", floorId: 3, area: 120, types: ["Dịch vụ"], availability: "leased", orientation: "Tây", plan: { x: 10, y: 0, width: 10, height: 10 } },
  { id: "4.1", floorId: 4, area: 200, types: ["Văn phòng"], availability: "available", orientation: "Nam", plan: { x: 0, y: 0, width: 10, height: 10 } },
];

test("status options and configurations contain required public statuses", () => {
  assert.equal(STATUS_CONFIG.available.label, "Còn trống");
  assert.equal(STATUS_CONFIG.available.tone, "success");
  assert.equal(STATUS_CONFIG.contact.label, "Liên hệ");
  assert.equal(STATUS_CONFIG.contact.tone, "warning");
  assert.equal(STATUS_CONFIG.leased.label, "Đã thuê");
  assert.equal(STATUS_CONFIG.leased.tone, "error");

  const optionValues = STATUS_OPTIONS.map(opt => opt.value);
  assert.deepEqual(optionValues, ["", "available", "contact", "leased"]);
});

test("matchesStatus correctly filters by public status", () => {
  const statuses: LeasingAvailability[] = ["available", "contact", "leased"];

  // Empty filter matches all
  for (const s of statuses) {
    assert.equal(matchesStatus(s, ""), true);
  }

  // Specific status filter matches only matching status
  for (const target of statuses) {
    for (const actual of statuses) {
      assert.equal(matchesStatus(actual, target as StatusFilter), actual === target);
    }
  }
});

test("matchesArea partitions units across boundary thresholds", () => {
  assert.equal(matchesArea(99.9, "small"), true);
  assert.equal(matchesArea(100, "small"), false);

  assert.equal(matchesArea(99.9, "medium"), false);
  assert.equal(matchesArea(100, "medium"), true);
  assert.equal(matchesArea(150, "medium"), true);
  assert.equal(matchesArea(150.1, "medium"), false);

  assert.equal(matchesArea(150, "large"), false);
  assert.equal(matchesArea(150.1, "large"), true);

  assert.equal(matchesArea(50, ""), true);
  assert.equal(matchesArea(120, ""), true);
  assert.equal(matchesArea(300, ""), true);
});

test("combined floor, area, and public status filtering", () => {
  function filterUnits(floorId: number, area: AreaFilter, status: StatusFilter) {
    return sampleUnits.filter(
      unit => unit.floorId === floorId && matchesArea(unit.area, area) && matchesStatus(unit.availability, status),
    );
  }

  // Filter floor 1, all areas, only available
  const floor1Available = filterUnits(1, "", "available");
  assert.deepEqual(floor1Available.map(u => u.id), ["A.1"]);

  // Filter floor 1, small area (< 100 m²), only contact
  const floor1SmallContact = filterUnits(1, "small", "contact");
  assert.deepEqual(floor1SmallContact.map(u => u.id), ["A.2"]);

  // Filter floor 1, large area (> 150 m²), only leased
  const floor1LargeLeased = filterUnits(1, "large", "leased");
  assert.deepEqual(floor1LargeLeased.map(u => u.id), ["A.3"]);

  // Filter floor 3, all areas, only available
  const floor3Available = filterUnits(3, "", "available");
  assert.deepEqual(floor3Available.map(u => u.id), ["3.1"]);

  // Filter floor 3, only contact (none exist)
  const floor3Contact = filterUnits(3, "", "contact");
  assert.deepEqual(floor3Contact.map(u => u.id), []);

  // Filter floor 4, large area, available
  const floor4LargeAvailable = filterUnits(4, "large", "available");
  assert.deepEqual(floor4LargeAvailable.map(u => u.id), ["4.1"]);
});
