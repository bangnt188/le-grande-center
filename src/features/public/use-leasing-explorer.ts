"use client";

import { useEffect, useMemo, useState } from "react";
import { matchesArea, type AreaFilter, type LeasingFloor, type LeasingUnit } from "./leasing-model";

export function useLeasingExplorer(floors: readonly LeasingFloor[], inventory: readonly LeasingUnit[]) {
  const floorGroups = useMemo<{ id: number; title: string; label: string; floors: readonly LeasingFloor[] }[]>(
    () => floors.filter(floor => floor.id !== 2).map(floor => ({
      id: floor.id,
      title: floor.id === 1 ? "Tầng 1–2" : `Tầng ${floor.id}`,
      label: floor.label,
      floors: floor.id === 1 ? floors.filter(item => item.id === 1 || item.id === 2) : [floor],
    })), [floors]);
  const [floorId, setFloorId] = useState(floors[0]?.id ?? 1);
  const [type, updateType] = useState("");
  const [area, updateArea] = useState<AreaFilter>("");
  const [selectedId, updateSelectedId] = useState("");
  const group = floorGroups.find(item => item.floors.some(floor => floor.id === floorId));
  const units = inventory.filter(unit => group?.floors.some(floor => floor.id === unit.floorId));
  const visible = units.filter(unit => (!type || unit.types.includes(type)) && matchesArea(unit.area, area));
  const selected = visible.find(unit => unit.id === selectedId) ?? null;

  useEffect(() => {
    function syncFloor() {
      const requestedId = new URLSearchParams(window.location.search).get("unit");
      const requestedUnit = inventory.find(unit => unit.id === requestedId && floors.some(floor => floor.id === unit.floorId));
      const match = window.location.hash.match(/^#tang-?(\d+)$/);
      const hashFloor = match ? Number(match[1]) : undefined;
      const id = floors.find(item => item.id === hashFloor)?.id ?? requestedUnit?.floorId ?? floors[0]?.id;
      if (id === undefined) return;
      const requestedGroup = floorGroups.find(item => item.floors.some(floor => floor.id === id));
      setFloorId(id);
      updateType("");
      updateArea("");
      updateSelectedId(requestedUnit && requestedGroup?.floors.some(floor => floor.id === requestedUnit.floorId) ? requestedUnit.id : "");
    }
    syncFloor();
    window.addEventListener("hashchange", syncFloor);
    window.addEventListener("popstate", syncFloor);
    return () => {
      window.removeEventListener("hashchange", syncFloor);
      window.removeEventListener("popstate", syncFloor);
    };
  }, [floors, inventory, floorGroups]);

  function chooseFloor(id: number) {
    if (!floors.some(item => item.id === id)) return;
    setFloorId(id);
    updateType("");
    updateArea("");
    updateSelectedId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("unit");
    url.hash = `tang-${id}`;
    window.history.replaceState(window.history.state, "", url);
  }
  function setSelectedId(id: string) {
    const unit = visible.find(unit => unit.id === id);
    if (!unit) return;
    setFloorId(unit.floorId);
    updateSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("unit", id);
    url.hash = `tang-${unit.floorId}`;
    window.history.replaceState(window.history.state, "", url);
  }
  function clearSelection() {
    updateSelectedId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("unit");
    window.history.replaceState(window.history.state, "", url);
  }
  function setType(value: string) { updateType(value); clearSelection(); }
  function setArea(value: AreaFilter) { updateArea(value); clearSelection(); }
  function clearFilters() { updateType(""); updateArea(""); clearSelection(); }
  return { floor: floors.find(item => item.id === floorId), group, floorGroups, units, visible, selected, type, area,
    unitTypes: [...new Set(units.flatMap(unit => [...unit.types]))],
    setType, setArea, setSelectedId, chooseFloor, clearFilters, clearSelection };
}
