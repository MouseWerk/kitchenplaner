// Deck oven (Pizzaofen, Etagenofen): one or two baking chambers stacked on a stand, each with a
// drop-down door with a window and a bar handle, and its own thermostats at the right.

import { INSET, PANEL } from "../parts/elevation";
import { DOOR, DOOR_RADIUS, GAP } from "../parts/mesh";
import { INSET as PLAN_INSET } from "../parts/plan";
import { MM_PER_UNIT } from "../../three/shared";
import type { KindDef } from "../types";
import { standFront, standMesh, unitFeet } from "./common";
import { doorWindow, pilot } from "./details";
import { controlPanel, housing } from "../parts/details";

/** Width of the thermostat panel at the right (m). */
const PANEL_W = 0.2;

function makeDeckOven(kind: string, decks: number): KindDef {
  return {
    kind,
    plan(s) {
      // The baking chamber behind the doors, the panel at the right.
      const panel = Math.min(PANEL_W * 1000, s.w / 4);
      s.rect("detail", s.L + PLAN_INSET * 2, s.B + PLAN_INSET * 2, s.R - panel - PLAN_INSET, s.F - PLAN_INSET * 2);
      s.line("detail", [s.R - panel, s.B + PLAN_INSET], [s.R - panel, s.F]);
    },
    elevationBase(f) {
      standFront(f);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const panel = Math.min(PANEL + INSET, f.w / 4);
      const dr = r - panel;
      const ch = (top - z0) / decks;
      for (let i = 0; i < decks; i++) {
        const b = z0 + ch * i;
        f.box("detail", l + INSET, dr - INSET / 2, b + INSET, b + ch - INSET / 2);
        f.box("detail", l + INSET * 3, dr - INSET * 3, b + INSET * 2, b + ch - INSET * 3, "glass");
        f.line("detail", [l + INSET * 3, b + ch - INSET * 1.5], [dr - INSET * 3, b + ch - INSET * 1.5]);
        f.box("detail", dr, r - INSET / 2, b + INSET, b + ch - INSET / 2, "item-dark");
        for (const k of [1, 2]) f.circle("detail", dr + (panel / 3) * k, b + ch / 2, Math.min(panel * 0.12, ch * 0.12));
      }
    },
    mesh(p, s, item) {
      const elev = item.elevation / MM_PER_UNIT;
      standMesh(p, s, elev);
      const y0 = unitFeet(p, s, elev > 0);
      const zf = s.d / 2;
      housing(p, "steel", -s.w / 2, s.w / 2, y0, s.h, -s.d / 2, zf - DOOR);
      const panelW = Math.min(PANEL_W, s.w / 4);
      const dx1 = s.w / 2 - panelW;
      const ch = (s.h - y0) / decks;
      const zFace = zf - DOOR / 2;
      for (let i = 0; i < decks; i++) {
        const b = y0 + ch * i;
        const t = b + ch;
        // Drop-down door with a wide window and the handle bar along its top.
        p.roundedBox("steel", -s.w / 2 + GAP * 2, dx1 - GAP, b + GAP * 2, t - GAP * 2, zf - DOOR, zFace, DOOR_RADIUS * 2, "top", "z");
        const wy0 = b + Math.min(0.08, ch * 0.2);
        const wy1 = t - Math.min(0.11, ch * 0.3);
        if (wy1 > wy0) doorWindow(p, -s.w / 2 + 0.08, dx1 - 0.08, wy0, wy1, zFace);
        const len = (dx1 + s.w / 2) * 0.7;
        p.barHandle("x", (-s.w / 2 + dx1) / 2 - len / 2, (-s.w / 2 + dx1) / 2 + len / 2, t - Math.min(0.05, ch * 0.15), zFace, zf);
        // The panel with the thermostats for the top and the bottom heat, a thermometer and a
        // pilot light.
        controlPanel(p, dx1 + GAP, s.w / 2 - GAP * 2, b + GAP * 2, t - GAP * 2, zf - DOOR, zFace);
        const px = (dx1 + s.w / 2) / 2;
        const kr = Math.min(0.022, ch * 0.08, panelW / 6);
        p.knob(px - panelW * 0.22, b + ch * 0.35, zFace, zf, kr);
        p.knob(px + panelW * 0.22, b + ch * 0.35, zFace, zf, kr);
        const gr = Math.min(0.035, ch * 0.12, panelW * 0.25);
        p.lathe("satin", px, b + ch * 0.68, zFace, [
          [0, 0],
          [gr, 0],
          [gr, 0.005],
          [gr * 0.88, 0.006],
          [0, 0.006],
        ], { axis: "z" });
        p.lathe("panel", px, b + ch * 0.68, zFace + 0.006, [
          [0, 0],
          [gr * 0.82, 0],
          [gr * 0.82, 0.0008],
          [0, 0.0008],
        ], { axis: "z" });
        pilot(p, px, b + ch * 0.15, zFace);
      }
      // The steam vent of each chamber on the top at the back.
      p.lathe("satin", -s.w / 4, s.h - 0.004, -s.d / 2 + 0.08, [
        [0, 0],
        [0.03, 0],
        [0.03, 0.002],
        [0.022, 0.004],
        [0, 0.004],
      ]);
    },
  };
}

export const deckOven1 = makeDeckOven("deckOven1", 1);
export const deckOven2 = makeDeckOven("deckOven2", 2);
