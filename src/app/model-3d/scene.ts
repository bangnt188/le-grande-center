import assetManifest from "../../../public/model-3d/asset-manifest.json";

export type CameraPresetId = "front" | "aerial" | "rearLake" | "side";
export type SceneTuple = [number, number, number];
export type SceneFloor = { floorId: string; order: number; elevation: number; label: string };
export type SceneSlot = {
  slotId: string;
  floorId: string;
  anchorId: string;
  outlineId: string;
  anchor: SceneTuple;
  width: number;
  confidence: "illustrative";
};

const floors: SceneFloor[] = [
  { floorId: "T1", order: 1, elevation: 2, label: "Shophouse thương mại · thông tầng 1–2" },
  { floorId: "T2", order: 2, elevation: 6, label: "Shophouse thương mại · thông tầng 1–2" },
  { floorId: "T3", order: 3, elevation: 10, label: "Dịch vụ – văn phòng" },
  { floorId: "T4", order: 4, elevation: 14, label: "Dịch vụ – văn phòng" },
  { floorId: "T5", order: 5, elevation: 18, label: "Giải trí · rạp chiếu phim dự kiến" },
  { floorId: "T6", order: 6, elevation: 22, label: "Dịch vụ ngoài trời – sự kiện (dự kiến)" },
];

// Stable B1–B11 identities follow the reference schematic, not measured inventory.
// Five west anchors precede the lobby; six east anchors follow it. Widths are model units.
const schematic: [number, number][] = [
  [-50, 10], [-41, 8], [-33, 8], [-25, 8], [-17, 8],
  [10, 8], [18, 8], [26, 8], [34, 8], [42, 8], [51, 10],
];

export const sceneManifest = {
  sceneId: "le-grande-centre",
  sceneVersion: "2026-10-07.3",
  units: "estimated-model-units",
  front: "+Z",
  assetManifestHash: assetManifest.assetManifestHash,
  // Presets frame the architecture once; subsequent orbit/close zoom remains free.
  cameraPresets: [
    { id: "front", position: [.7, .08, 1], target: [0, 12, 0], fov: 34 },
    { id: "aerial", position: [.54, .35, 1], target: [-4, 12, 20], fov: 38 },
    { id: "rearLake", position: [-.32, .16, -1], target: [0, 12, -22], fov: 34 },
    { id: "side", position: [1, .12, .32], target: [0, 12, 0], fov: 34 },
  ] satisfies { id: CameraPresetId; position: SceneTuple; target: SceneTuple; fov: number }[],
  floors,
  slots: floors.flatMap(floor => schematic.map(([x, width], index): SceneSlot => {
    const slotId = `${floor.floorId}-B${index + 1}`;
    return {
      slotId, floorId: floor.floorId, anchorId: `${slotId}-anchor`, outlineId: `${slotId}-outline`,
      anchor: [x, floor.elevation, 14], width, confidence: "illustrative",
    };
  })),
  context: [
    {
      id: "front-forecourt-road-roundabout-monument", confidence: "verified",
      source: "Project reference confirms front → forecourt → road/roundabout and monument; direction only.",
    },
    {
      id: "rear-lake", confidence: "verified",
      source: "Project reference confirms lake behind the building; direction only.",
    },
    {
      id: "site-geometry", confidence: "illustrative",
      source: "Estimated scene geometry; no surveyed site plan. Reference image informs palette, monument and landscape only, never building architecture.",
    },
    {
      id: "slot-schematic", confidence: "illustrative",
      source: "Customer reference schematic has no confirmed floor; repeated anchors preserve IDs, not measured floorplans or approved leasing inventory.",
    },
  ],
} as const;
