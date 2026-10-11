import type { CSSProperties } from "react";
import type { PlanShape } from "./leasing-model";

// Brochure geometry uses a 1000×250 canvas; label positions are already percentages.
export function planStyle(shape: PlanShape): CSSProperties {
  return { left: shape.x / 10 + "%", top: shape.y / 2.5 + "%", width: shape.width / 10 + "%", height: shape.height / 2.5 + "%", clipPath: shape.polygon };
}

export function planLabelStyle(shape: PlanShape): CSSProperties | undefined {
  const point = shape.labelPosition;
  return point && { position: "absolute", left: point.x + "%", top: point.y + "%", transform: "translate(-50%, -50%)" };
}
