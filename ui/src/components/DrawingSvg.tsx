// Draws a Drawing (render/drawing.ts) on screen: the same primitives the SVG and DXF exports
// write, here with the theme's colors from the design tokens.

import { memo } from "react";
import { expandDim, type Drawing, type Fill, type Pen, type Shape } from "../render/drawing";
import { PEN_STYLE } from "../render/style";

/** Drawing units per paper millimetre on screen: text and dimension offsets as at 1:40. */
export const SCREEN_PAPER_SCALE = 40;
/** Screen pixels per paper millimetre of pen width (non-scaling strokes). */
const PX_PER_PEN_MM = 3.2;
/** The thinnest line that still reads on screen. */
const MIN_STROKE_PX = 0.75;

const FILL_VAR: Record<Fill, string> = {
  none: "none",
  wall: "var(--draw-wall-fill)",
  item: "var(--draw-item-fill)",
  "item-dark": "var(--draw-item-dark)",
  glass: "var(--draw-glass)",
  warning: "var(--draw-warning-fill)",
};

function strokeOf(pen: Pen): string {
  return pen === "dim" ? "var(--draw-dim)" : pen === "detail" || pen === "hidden" || pen === "swing" ? "var(--draw-detail)" : "var(--draw-line)";
}

function penProps(pen: Pen) {
  const st = PEN_STYLE[pen];
  return {
    stroke: strokeOf(pen),
    strokeWidth: Math.max(MIN_STROKE_PX, st.width * PX_PER_PEN_MM),
    strokeDasharray: st.dash?.map((d) => d * SCREEN_PAPER_SCALE).join(" "),
    vectorEffect: "non-scaling-stroke" as const,
  };
}

function ShapeEl({ s }: { s: Shape }) {
  switch (s.t) {
    case "poly": {
      const d = s.pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("") + (s.closed ? "Z" : "");
      return <path d={d} fill={s.closed ? FILL_VAR[s.fill ?? "none"] : "none"} {...penProps(s.pen)} data-item={s.itemId} />;
    }
    case "circle":
      return <circle cx={s.c.x} cy={s.c.y} r={s.r} fill={FILL_VAR[s.fill ?? "none"]} {...penProps(s.pen)} data-item={s.itemId} />;
    case "arc":
      return <path d={arcPath(s.c.x, s.c.y, s.r, s.a0, s.a1)} fill="none" {...penProps(s.pen)} data-item={s.itemId} />;
    case "text":
      return <TextEl s={s} />;
    case "dim": {
      const e = expandDim(s, SCREEN_PAPER_SCALE);
      return (
        <g>
          {e.lines.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...penProps("dim")} />
          ))}
          <TextEl s={e.text} />
        </g>
      );
    }
  }
}

function TextEl({ s }: { s: Extract<Shape, { t: "text" }> }) {
  const size = s.size * SCREEN_PAPER_SCALE;
  const transform = s.angle ? `rotate(${s.angle} ${s.p.x} ${s.p.y})` : undefined;
  return (
    <g transform={transform} data-item={s.itemId}>
      {s.circled && <circle cx={s.p.x} cy={s.p.y - size * 0.36} r={size * 0.95} fill="var(--draw-item-fill)" {...penProps("detail")} />}
      <text
        x={s.p.x}
        y={s.circled ? s.p.y - size * 0.36 : s.p.y}
        fontSize={size}
        textAnchor={s.anchor}
        dominantBaseline={s.circled ? "central" : undefined}
        fill={s.pen === "dim" ? "var(--draw-dim)" : "var(--draw-line)"}
        className="draw-text"
      >
        {s.text}
      </text>
    </g>
  );
}

/** An SVG arc path; angles in degrees, clockwise on screen from +x, drawn from a0 to a1. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const sweep = ((a1 - a0) % 360 + 360) % 360 || 360;
  const p0 = { x: cx + r * Math.cos((a0 * Math.PI) / 180), y: cy + r * Math.sin((a0 * Math.PI) / 180) };
  const p1 = { x: cx + r * Math.cos((a1 * Math.PI) / 180), y: cy + r * Math.sin((a1 * Math.PI) / 180) };
  return `M${p0.x} ${p0.y}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}

/** The shapes of a drawing as SVG elements, in drawing units (the parent applies the viewport). */
export const DrawingShapes = memo(function DrawingShapes({ drawing }: { drawing: Drawing }) {
  return (
    <>
      {drawing.shapes.map((s, i) => (
        <ShapeEl key={i} s={s} />
      ))}
    </>
  );
});
