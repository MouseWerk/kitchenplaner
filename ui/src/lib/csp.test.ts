// index.html stays compatible with a strict Content Security Policy: no inline script, no inline
// style. Scripts load from files (`<script src>`), styles come from the bundled stylesheets.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");

describe("index.html", () => {
  it("has script tags", () => {
    expect(html).toMatch(/<script\b/i);
  });

  it("has no inline script", () => {
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      expect(m[1], m[0]).toMatch(/\bsrc\s*=/i);
      expect(m[2].trim(), m[0]).toBe("");
    }
  });

  it("has no inline event handlers or javascript: URLs", () => {
    expect(html.match(/<[^>]+\son[a-z]+\s*=/gi) ?? []).toEqual([]);
    expect(html.match(/javascript:/gi) ?? []).toEqual([]);
  });

  it("has no style element or style attribute", () => {
    expect(html.match(/<style\b/gi) ?? []).toEqual([]);
    expect(html.match(/<[^>]+\sstyle\s*=/gi) ?? []).toEqual([]);
  });
});
