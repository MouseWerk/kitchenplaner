// Aligning and distributing in the inspector, for two or more selected items (lib/align.ts):
// icon buttons in three rows, each with its name as tooltip and accessible name.

import type { ComponentType } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyStart,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyStart,
  type LucideProps,
} from "lucide-react";
import { alignSelected, distributeSelected, packSelected } from "../lib/align";
import { useT, type TKey } from "../lib/i18n";

interface Tool {
  key: TKey;
  icon: ComponentType<LucideProps>;
  run: () => void;
  /** Least number of selected items for the tool to change anything. */
  min?: number;
}

const ROWS: Tool[][] = [
  [
    { key: "align.left", icon: AlignStartVertical, run: () => alignSelected("left") },
    { key: "align.centreX", icon: AlignCenterVertical, run: () => alignSelected("centreX") },
    { key: "align.right", icon: AlignEndVertical, run: () => alignSelected("right") },
    { key: "align.top", icon: AlignStartHorizontal, run: () => alignSelected("top") },
    { key: "align.centreY", icon: AlignCenterHorizontal, run: () => alignSelected("centreY") },
    { key: "align.bottom", icon: AlignEndHorizontal, run: () => alignSelected("bottom") },
  ],
  [
    { key: "align.distributeX", icon: AlignHorizontalDistributeCenter, run: () => distributeSelected("x"), min: 3 },
    { key: "align.distributeY", icon: AlignVerticalDistributeCenter, run: () => distributeSelected("y"), min: 3 },
    { key: "align.packX", icon: AlignHorizontalJustifyStart, run: () => packSelected("x") },
    { key: "align.packY", icon: AlignVerticalJustifyStart, run: () => packSelected("y") },
  ],
];

export function AlignTools({ count }: { count: number }) {
  const t = useT();
  return (
    <section className="insp-section align-tools" aria-label={t("align.title")}>
      <div className="insp-section-head">
        <h3 className="eyebrow">{t("align.title")}</h3>
      </div>
      {ROWS.map((row, i) => (
        <div key={i} className="align-row" role="group">
          {row.map((tool) => {
            const Icon = tool.icon;
            const label = t(tool.key);
            const disabled = count < (tool.min ?? 2);
            return (
              <button key={tool.key} type="button" className="icon-btn" title={disabled ? t("align.needsThree") : label} aria-label={label} disabled={disabled} onClick={tool.run}>
                <Icon size={17} strokeWidth={1.75} aria-hidden />
              </button>
            );
          })}
        </div>
      ))}
      <p className="align-note">{t("align.note")}</p>
    </section>
  );
}
