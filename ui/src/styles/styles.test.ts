// Static guards over every stylesheet in this folder (design/guard-tests.md). A design rule that is
// not tested comes back: colors, weights, layers and the focus ring come from tokens.css; selected,
// current, hover and focused states are a neutral tint, never an accent- or status-colored frame;
// nothing has a colored bar at its left side.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(__dirname);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css"));
const others = sheets.filter((f) => f !== "tokens.css");
const raw = (name: string) => readFileSync(resolve(dir, name), "utf8");
const code = (name: string) => raw(name).replace(/\/\*[\s\S]*?\*\//g, "");

type Rule = { selector: string; decls: (readonly [string, string])[] };
/** The innermost rules of a sheet (rules inside @media come out with their own selector). */
const rules = (name: string): Rule[] =>
  [...code(name).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].replace(/\s+/g, " ").trim(),
    decls: m[2]
      .split(";")
      .filter((d) => d.includes(":"))
      .map((d) => [d.slice(0, d.indexOf(":")).trim().toLowerCase(), d.slice(d.indexOf(":") + 1).trim()] as const),
  }));
const isKeyframeStep = (selector: string) => /^(@|from\b|to\b|\d)/.test(selector);

it("finds the stylesheets", () => {
  expect(sheets).toEqual(expect.arrayContaining(["tokens.css", "base.css", "app.css"]));
});

// The sheets are bundled into one file: an unclosed rule silently swallows every rule after it.
describe("stylesheets", () => {
  for (const name of sheets) {
    it(`${name} has balanced braces and no merge markers`, () => {
      const css = raw(name);
      expect(css).not.toMatch(/^(<<<<<<<|=======|>>>>>>>)/m);
      const stripped = code(name).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "");
      let depth = 0;
      for (const ch of stripped) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
    });
  }
});

// A literal color outside tokens.css does not follow the theme. Every exception is a selector
// regex plus its reason; there is none so far.
const LITERAL_COLORS_OK: [RegExp, string][] = [];
const NAMED_COLOR = /(^|[\s,(])(white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|navy|teal)\b/i;

describe("literal colors", () => {
  for (const name of others) {
    it(`${name} takes its colors from the tokens`, () => {
      const bad: string[] = [];
      for (const { selector, decls } of rules(name)) {
        if (LITERAL_COLORS_OK.some(([re]) => re.test(selector))) continue;
        for (const [p, v] of decls) {
          // Black shadows and scrims are black in every theme.
          const value = v.replace(/rgba?\(\s*0[\s,]+0[\s,]+0\s*[/,]\s*[\d.]+%?\s*\)/g, "");
          if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|lab\(/i.test(value) || (!/^(font|content|grid|transition|animation)/.test(p) && NAMED_COLOR.test(value))) {
            bad.push(`${selector} { ${p}: ${v} }`);
          }
        }
      }
      expect(bad, "add a token to tokens.css (both themes)").toEqual([]);
    });
  }
});

describe("design tokens", () => {
  for (const name of others) {
    it(`${name} takes weights, layers, focus ring and pill radii from the tokens`, () => {
      const css = code(name);
      expect(css.match(/font-weight:\s*(\d+|bold|bolder|lighter)\b[^;}]*/g) ?? [], "use var(--fw-*)").toEqual([]);
      expect(css.match(/z-index:\s*-?[1-9]\d*[^;}]*/g) ?? [], "use var(--z-*)").toEqual([]);
      expect(css.match(/border-radius:[^;}]*\b999px/g) ?? [], "use var(--r-pill)").toEqual([]);
    });

    it(`${name} draws focus outlines only with var(--focus-ring)`, () => {
      const bad: string[] = [];
      for (const { selector, decls } of rules(name)) {
        for (const [p, v] of decls) {
          if (p === "outline" && !/^(none|0|var\(--focus-ring\))$/.test(v)) bad.push(`${selector} { ${p}: ${v} }`);
          if (/^outline-(color|style|width)$/.test(p)) bad.push(`${selector} { ${p}: ${v} }`);
        }
      }
      expect(bad).toEqual([]);
    });

    it(`${name} sets the mono font without ligatures`, () => {
      const odd: string[] = [];
      for (const { selector, decls } of rules(name)) {
        const mono = decls.some(([p, v]) => /^font(-family)?$/.test(p) && /var\(--font-mono\)/.test(v));
        if (mono && !decls.some(([p, v]) => p === "font-variant-ligatures" && v === "none")) odd.push(selector);
      }
      expect(odd, "add font-variant-ligatures: none").toEqual([]);
    });

    it(`${name} styles uppercase labels with the eyebrow letter spacing`, () => {
      const odd: string[] = [];
      for (const { selector, decls } of rules(name)) {
        const upper = decls.some(([p, v]) => p === "text-transform" && v === "uppercase");
        const spacing = decls.find(([p]) => p === "letter-spacing")?.[1];
        if (upper && spacing && spacing !== "var(--ls-eyebrow)") odd.push(selector);
      }
      expect(odd, "use var(--ls-eyebrow)").toEqual([]);
    });
  }
});

// Selected, current, hover and focused items are a neutral tint plus text weight or color, never
// an accent or status frame; keyboard focus is the neutral ring.
describe("selection and focus look", () => {
  const STATE =
    /\.(active|selected|sel|current|on|checked|picked|now|today|focused|is-selected|is-current|is-active|is-open|is-editing|recording|running|live|playing)\b|:(hover|active|checked|focus(-visible|-within)?)\b|\[aria-(selected|current|pressed|checked|expanded)/;
  const FRAME = /^(border(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?(-color)?|outline(-color)?|box-shadow)$/;
  const ACCENT = /--(accent(-strong|-soft|-text)?|success|warning|danger|info)(-soft)?\b/;
  const COLORED = /--(accent|success|warning|danger|info)|#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix/i;
  const SIDE = /^border-(left|inline-start)(-color|-width)?$/;

  for (const name of others) {
    it(`${name}: states have no accent or status frame`, () => {
      const bad: string[] = [];
      for (const { selector, decls } of rules(name)) {
        if (!STATE.test(selector) || isKeyframeStep(selector)) continue;
        for (const [p, v] of decls) if (FRAME.test(p) && ACCENT.test(v)) bad.push(`${selector} { ${p}: ${v} }`);
      }
      expect(bad, "use --bg-hover/--bg-active/--bg-selected/--bg-current and --focus-ring").toEqual([]);
    });

    it(`${name}: no colored rings or glows anywhere`, () => {
      const bad: string[] = [];
      for (const { selector, decls } of rules(name)) {
        for (const [p, v] of decls) {
          if (p === "box-shadow" && ACCENT.test(v)) bad.push(`${selector} { ${p}: ${v} }`);
          if (/^border-image/.test(p) || (/^border/.test(p) && /gradient\(/.test(v))) bad.push(`${selector} { ${p}: ${v} } (gradient border)`);
        }
      }
      expect(bad, "status color goes into icons, small text and fills").toEqual([]);
    });

    it(`${name}: no bar at the left side`, () => {
      const bad: string[] = [];
      for (const { selector, decls } of rules(name)) {
        if (/blockquote/.test(selector)) continue;
        const get = (p: string) => decls.find(([q]) => q === p)?.[1] ?? "";
        for (const [p, v] of decls) {
          const line = `${selector} { ${p}: ${v} }`;
          // A side line in a color token is a bar; dividers are grid gaps or a neutral shadow.
          if (SIDE.test(p) && /var\(--|#[0-9a-f]{3,8}\b|rgba?\(|\b([2-9]|\d{2,})px\b/i.test(v)) bad.push(line);
          // An inset shadow offset sideways draws a bar.
          if (p === "box-shadow" && /inset\s+-?[1-9]\d*(px)?\s+0\b/.test(v)) bad.push(line);
        }
        // A thin pseudo element along the left edge in a color.
        if (/::(before|after)/.test(selector) && /^0(px)?$/.test(get("left")) && /^[1-4]px$/.test(get("width")) && COLORED.test(get("background") || get("background-color"))) {
          bad.push(`${selector} (side bar)`);
        }
      }
      expect(bad, "use a tinted background and an icon").toEqual([]);
    });
  }

  it("focus and selection tokens are neutral", () => {
    const css = code("tokens.css");
    for (const token of ["--border-focus", "--focus-ring", "--focus-soft", "--bg-hover", "--bg-active", "--bg-selected", "--bg-current", "--draw-selected-fill", "--draw-hover-fill"]) {
      const values = [...css.matchAll(new RegExp(`${token}:\\s*([^;]+);`, "g"))].map((m) => m[1]);
      expect(values.length, token).toBeGreaterThan(0);
      for (const v of values) expect(v, token).not.toMatch(ACCENT);
    }
  });

  it("focus is visible: base.css draws the ring on :focus-visible", () => {
    const ring = rules("base.css").find(({ selector }) => selector === ":focus-visible");
    expect(ring?.decls).toContainEqual(["outline", "var(--focus-ring)"]);
  });
});

// Light is written twice (system preference and the explicit choice); both must stay identical,
// and every theme defines the same tokens.
describe("themes", () => {
  const css = code("tokens.css");
  const vars = (body: string) => new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].replace(/\s+/g, " ").trim()]));
  const block = (re: RegExp) => {
    const m = css.match(re);
    expect(m, String(re)).toBeTruthy();
    return vars(m![1]);
  };
  const dark = block(/:root,\s*:root\[data-theme="dark"\]\s*\{([^{}]*)\}/);
  const lightSystem = block(/@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme="dark"\]\)\s*\{([^{}]*)\}/);
  const lightChosen = block(/:root\[data-theme="light"\]\s*\{([^{}]*)\}/);

  it("the two light blocks are identical", () => {
    expect(Object.fromEntries(lightChosen)).toEqual(Object.fromEntries(lightSystem));
  });

  it("dark and light define the same tokens", () => {
    expect([...lightSystem.keys()].sort()).toEqual([...dark.keys()].sort());
  });

  // The 3D outline lies on light steel and walls in both themes; a light theme color would vanish.
  it("the 3D outline is dark in every theme", () => {
    for (const theme of [dark, lightSystem]) {
      const hex = theme.get("--draw-outline-3d") ?? "";
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeLessThan(0.25);
    }
  });
});

// Motion: an endless animation repaints every frame; only opacity and transform may loop, and
// every sheet with animations or transitions honors prefers-reduced-motion (base.css does it for all).
describe("motion", () => {
  const all = sheets.map(code).join("\n");
  const keyframes = new Map<string, string>();
  for (const m of all.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) keyframes.set(m[1], m[2]);

  it("endless animations loop only opacity and transform", () => {
    const bad: string[] = [];
    for (const m of all.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      for (const a of m[2].matchAll(/animation(?:-name)?\s*:\s*([^;]+)/g)) {
        if (!/\binfinite\b/.test(a[1])) continue;
        const name = a[1].split(/[\s,]+/).find((w) => keyframes.has(w)) ?? "";
        const props = [...(keyframes.get(name) ?? "?:").matchAll(/([\w-]+)\s*:/g)].map((p) => p[1]);
        if (!name || props.some((p) => p !== "opacity" && p !== "transform")) bad.push(m[1].trim());
      }
    }
    expect(bad).toEqual([]);
  });

  it("base.css turns animations and transitions off for prefers-reduced-motion", () => {
    expect(code("base.css")).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*animation-duration[^}]*transition-duration/);
  });
});
