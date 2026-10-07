import type { LeasingFloor, LeasingUnit, PlanShape } from "./leasing-model";

export const BROCHURE_PATH = "/le-grande-brochure.pdf";

// Pages 5–10 of the supplied brochure. Areas are the printed values, not
// width × depth recalculations. Diagram coordinates reproduce the layout,
// not surveyed boundaries or live availability.
const shophouse = ["Shophouse"];
const flexible = ["Mặt bằng linh hoạt"];
const cinema = ["Rạp chiếu phim (dự kiến)"];
const outdoor = ["Dịch vụ ngoài trời"];

function row(floorId: number, prefix: string, first: number, sizes: readonly (readonly [number, number])[], depth: number, x: number, y: number, types: readonly string[]): LeasingUnit[] {
  return sizes.map(([area, width], index) => {
    const unit: LeasingUnit = {
      id: `${prefix}.${first + index}`, floorId, area, types,
      dimensions: { width, depth },
      plan: { x, y, width: width * 10, height: depth * 10 },
      ...(floorId < 3 ? { note: `Liên thông với căn ${floorId === 1 ? "B" : "A"}.${first + index} ở tầng ${floorId === 1 ? 2 : 1} theo brochure.` } : {}),
    };
    x += width * 10;
    return unit;
  });
}

const aWest = [[190, 10], [152, 8], [152, 8], [152, 8], [152, 8]] as const;
const aEast = [[152, 8], [152, 8], [152, 8], [152, 8], [152, 8], [190, 10]] as const;
const bWest = [[205, 10], [164, 8], [164, 8], [164, 8], [164, 8]] as const;
const bEast = [[164, 8], [164, 8], [164, 8], [164, 8], [164, 8], [205, 10]] as const;
const upperWest = [[54, 5.5], [78, 8], [78, 8], [78, 8], [78, 8]] as const;
const upperEast = [[78, 8], [78, 8], [78, 8], [78, 8], [78, 8], [54, 5.5]] as const;
const lower = [[83, 9.9], [67, 8], [67, 8], [67, 8], [67, 8], [67, 8], [67, 8], [67, 8], [67, 8], [67, 8], [67, 8], [83, 9.9]] as const;

export const BROCHURE_UNITS: readonly LeasingUnit[] = [
  ...row(1, "A", 1, aWest, 19, 0, 20, shophouse),
  ...row(1, "A", 6, aEast, 19, 500, 20, shophouse),
  ...row(2, "B", 1, bWest, 20.5, 0, 20, shophouse),
  ...row(2, "B", 6, bEast, 20.5, 500, 20, shophouse),
  ...row(3, "C", 1, upperWest, 9.8, 45, 20, flexible),
  ...row(3, "C", 6, upperEast, 9.8, 500, 20, flexible),
  ...row(3, "C", 12, lower, 8.4, 0, 136, flexible),
  ...row(4, "D", 1, upperWest, 9.8, 45, 20, flexible),
  ...row(4, "D", 6, upperEast, 9.8, 500, 20, flexible),
  ...row(4, "D", 12, lower, 8.4, 0, 136, flexible),
  ...row(5, "E", 1, [[79, 8.1], [78, 8], [78, 8], [78, 8]], 9.8, 19, 20, flexible),
  ...row(5, "E", 5, [[1000, 50]], 20, 500, 20, cinema),
  ...row(5, "E", 6, [[83, 9.9], [67, 8], [67, 8], [67, 8], [67, 8], [67, 8]], 8.4, 0, 136, flexible),
  ...row(6, "F", 1, [[46, 7.8]], 6, 340, 80, []),
  { id: "F.2", floorId: 6, area: 1020, types: outdoor,
    note: "Không gian ngoài trời; brochure gợi ý café, ăn uống, ngắm cảnh, hội nghị và sự kiện. Không có kích thước cạnh đầy đủ trong tài liệu.",
    plan: { x: 0, y: 20, width: 1000, height: 200,
      polygon: "polygon(0% 0%, 34% 0%, 34% 60%, 50% 60%, 50% 80%, 100% 80%, 100% 100%, 0% 100%)",
      labelPosition: { x: 17, y: 45 },
    },
  },
];

type SharedArea = PlanShape & { label: string };
const rear: SharedArea = { x: 0, y: 0, width: 1000, height: 20, label: "Hành lang thoát hiểm sau nhà" };
const lobby: SharedArea = { x: 420, y: 20, width: 80, height: 116, label: "Sảnh giữa · Thang máy / thang bộ" };
const corridor: SharedArea = { x: 0, y: 118, width: 1000, height: 18, label: "Hành lang" };
const pairedFloorAreas: readonly SharedArea[] = [
  rear, lobby, corridor,
  { x: 0, y: 20, width: 45, height: 98, label: "WC" },
  { x: 955, y: 20, width: 45, height: 98, label: "WC" },
];

export const BROCHURE_FLOORS: readonly LeasingFloor[] = [
  { id: 1, label: "Shophouse liên thông", sourcePage: 5,
    description: "11 căn shophouse riêng biệt liên thông lên tầng 2. Sảnh giữa tiếp cận tầng 3–6 bằng thang máy hoặc thang bộ.",
    sharedAreas: [{ x: 420, y: 20, width: 80, height: 190, label: "Sảnh giữa · Thang máy / thang bộ" }],
  },
  { id: 2, label: "Shophouse liên thông", sourcePage: 6,
    description: "11 căn shophouse liên thông từ tầng 1. Khoảng thông tầng giữa tạo không gian trưng bày cho B.5 hoặc B.6.",
    sharedAreas: [
      { x: 420, y: 20, width: 80, height: 120, label: "Sảnh giữa · Thang máy / thang bộ" },
      { x: 420, y: 140, width: 80, height: 85, label: "Thông tầng · Trưng bày B.5 / B.6" },
    ],
  },
  { id: 3, label: "Mặt bằng linh hoạt", sourcePage: 7,
    description: "3 khu mặt bằng lớn với phương án phân chia linh hoạt thành 23 ô C.1–C.23, phù hợp nhiều quy mô kinh doanh.",
    sharedAreas: pairedFloorAreas,
  },
  { id: 4, label: "Mặt bằng linh hoạt", sourcePage: 8,
    description: "3 khu mặt bằng lớn với phương án phân chia linh hoạt thành 23 ô D.1–D.23, phù hợp nhiều quy mô kinh doanh.",
    sharedAreas: pairedFloorAreas,
  },
  { id: 5, label: "Mặt bằng & rạp dự kiến", sourcePage: 9,
    description: "2 khu mặt bằng có thể phân chia linh hoạt. Không gian E.5 rộng 1.000 m² được định hướng cho cụm rạp chiếu phim.",
    sharedAreas: [rear, lobby, { ...corridor, width: 500 },
      { x: 340, y: 20, width: 80, height: 98, label: "WC công cộng" }],
  },
  { id: 6, label: "Dịch vụ ngoài trời", sourcePage: 10,
    description: "F.1: 46 m²; F.2: 1.020 m² không gian ngoài trời. Kết nối với khoảng thông tầng của không gian rạp chiếu phim dự kiến.",
    sharedAreas: [rear,
      { x: 340, y: 20, width: 78, height: 60, label: "WC" },
      { x: 420, y: 20, width: 80, height: 120, label: "Sảnh giữa · Thang máy / thang bộ" },
      { x: 500, y: 20, width: 500, height: 160, label: "Thông tầng · Không gian rạp chiếu phim dự kiến" },
    ],
  },
];
