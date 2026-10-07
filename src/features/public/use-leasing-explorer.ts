"use client";

import { useEffect, useState } from "react";
import { matchesArea, type AreaFilter, type LeasingFloor, type LeasingUnit } from "./leasing-model";

export function useLeasingExplorer(floors: readonly LeasingFloor[], inventory: readonly LeasingUnit[], initialSelectedId?: string) {
  const [floorId, setFloorId] = useState(floors[0]?.id ?? 1);
  const [type, setType] = useState("");
  const [area, setArea] = useState<AreaFilter>("");
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? "");

  useEffect(() => {
    function syncFloor() {
      const match = window.location.hash.match(/^#tang-(\d+)$/);
      const id = match ? Number(match[1]) : floors[0]?.id;
      if (id === undefined || !floors.some(item => item.id === id)) return;
      setFloorId(id);
      setType("");
      setArea("");
      setSelectedId(initialSelectedId ?? "");
    }
    syncFloor();
    window.addEventListener("hashchange", syncFloor);
    return () => window.removeEventListener("hashchange", syncFloor);
  }, [floors, initialSelectedId]);

  function chooseFloor(id: number) {
    if (!floors.some(item => item.id === id)) return;
    setFloorId(id);
    setType("");
    setArea("");
    setSelectedId(initialSelectedId ?? "");
    window.history.replaceState(window.history.state, "", `#tang-${id}`);
  }
  function clearFilters() { setType(""); setArea(""); }
  const units = inventory.filter(unit => unit.floorId === floorId);
  const visible = units.filter(unit => (!type || unit.types.includes(type)) && matchesArea(unit.area, area));
  const selected = visible.find(unit => unit.id === selectedId) ?? visible[0] ?? null;
  return { floor: floors.find(item => item.id === floorId), units, visible, selected, type, area,
    unitTypes: [...new Set(inventory.flatMap(unit => [...unit.types]))],
    setType, setArea, setSelectedId, chooseFloor, clearFilters };
}
