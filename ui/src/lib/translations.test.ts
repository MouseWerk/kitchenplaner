// The translation check (design/writing.md): de.ts and en.ts have the same keys, no empty texts,
// the same placeholders and plural shape per key, no emoji, no space before an ellipsis, the
// glossary is kept and no German is left in English texts. True exceptions go into ALLOWED with
// the reason.

import { describe, expect, it } from "vitest";
import { de, type Msg } from "../locales/de";
import { en } from "../locales/en";

type Lang = "de" | "en";
type Text = { key: string; where: string; lang: Lang; text: string };

/** A finding of `rule` at `where` (a key, or `key.one`/`key.other`) that is accepted. */
const ALLOWED: { rule: string; where: string; reason: string }[] = [];
const allowed = (rule: string, where: string) => ALLOWED.some((a) => a.rule === rule && (a.where === where || where.startsWith(`${a.where}.`)));

const catalogs: Record<Lang, Record<string, Msg>> = { de, en };

function textsOf(lang: Lang): Text[] {
  return Object.entries(catalogs[lang]).flatMap(([key, msg]) =>
    typeof msg === "string"
      ? [{ key, where: key, lang, text: msg }]
      : [
          { key, where: `${key}.one`, lang, text: msg?.one },
          { key, where: `${key}.other`, lang, text: msg?.other },
        ],
  );
}
const all = [...textsOf("de"), ...textsOf("en")];

/** Findings of `rule`: the texts for which `bad` returns true, minus the allowed ones. */
function check(rule: string, texts: Text[], bad: (t: Text) => boolean): string[] {
  return texts.filter((t) => typeof t.text === "string" && bad(t) && !allowed(rule, t.where)).map((t) => `${t.lang} ${t.where}: ${t.text}`);
}

const placeholders = (s: string) => [...new Set([...(s ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe("catalogs", () => {
  it("have the same keys in both languages", () => {
    const deKeys = Object.keys(de);
    const enKeys = Object.keys(en);
    expect(deKeys.filter((k) => !(k in en)), "missing in en.ts").toEqual([]);
    expect(enKeys.filter((k) => !(k in de)), "missing in de.ts").toEqual([]);
  });

  it("have no empty texts", () => {
    expect(check("empty", all, (t) => t.text.trim() === "")).toEqual([]);
    expect(all.filter((t) => typeof t.text !== "string").map((t) => `${t.lang} ${t.where}`)).toEqual([]);
  });

  it("have no text with surrounding spaces or double spaces", () => {
    expect(check("spaces", all, (t) => t.text !== t.text.trim() || / {2}/.test(t.text))).toEqual([]);
  });

  it("use the same plural shape in both languages, with both forms", () => {
    const bad: string[] = [];
    for (const key of Object.keys(de)) {
      const d = (de as Record<string, Msg>)[key];
      const e = (en as Record<string, Msg>)[key];
      if (e === undefined) continue;
      if (typeof d !== typeof e) bad.push(`${key}: plural in one language only`);
      for (const [lang, m] of [["de", d], ["en", e]] as const) {
        if (typeof m === "object" && (typeof m.one !== "string" || typeof m.other !== "string" || !m.one || !m.other)) bad.push(`${lang} ${key}: needs one and other`);
        if (typeof m === "object" && !(placeholders(m.one).includes("n") && placeholders(m.other).includes("n")) && !allowed("plural-n", key)) {
          bad.push(`${lang} ${key}: a plural picks its form by {n}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("use the same placeholders in both languages", () => {
    const bad: string[] = [];
    for (const key of Object.keys(de)) {
      const d = (de as Record<string, Msg>)[key];
      const e = (en as Record<string, Msg>)[key];
      if (e === undefined || allowed("placeholders", key)) continue;
      const forms = (m: Msg) => (typeof m === "string" ? [m] : [m.one, m.other]);
      const want = placeholders(forms(d).join(" ")).join(",");
      for (const [lang, m] of [["de", d], ["en", e]] as const) {
        for (const f of forms(m)) {
          const got = placeholders(f).join(",");
          // A plural's "one" form may spell out the number instead of {n}.
          if (got !== want && !(typeof m === "object" && f === m.one && got === want.split(",").filter((p) => p !== "n").join(","))) {
            bad.push(`${lang} ${key}: {${got}} instead of {${want}}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("close every placeholder brace", () => {
    expect(check("braces", all, (t) => (t.text.match(/\{/g) ?? []).length !== (t.text.match(/\}/g) ?? []).length)).toEqual([]);
  });
});

describe("typography", () => {
  it("has no emoji", () => {
    expect(check("emoji", all, (t) => /\p{Extended_Pictographic}|️/u.test(t.text.replace(/[©®™]/g, "")))).toEqual([]);
  });

  it("puts the ellipsis right after the word, as one character", () => {
    expect(check("ellipsis", all, (t) => /\s…/.test(t.text) || /\.\.\./.test(t.text))).toEqual([]);
  });

  it("uses typographic quotes in each language", () => {
    expect(check("quotes", all, (t) => /"/.test(t.text))).toEqual([]);
    // German „…“, English “…”.
    expect(check("quotes", textsOf("en"), (t) => /„/.test(t.text))).toEqual([]);
    expect(check("quotes", textsOf("de"), (t) => /”/.test(t.text))).toEqual([]);
  });
});

describe("glossary and leftovers", () => {
  it("German texts say „Computer“, not „Rechner“", () => {
    expect(check("glossary", textsOf("de"), (t) => /rechner/i.test(t.text))).toEqual([]);
  });

  it("English texts have no German umlauts or ß left over", () => {
    expect(check("german", textsOf("en"), (t) => /[äöüÄÖÜß]/.test(t.text))).toEqual([]);
  });

  it("English texts have no common German words left over", () => {
    const words = /(?<!\p{L})(und|oder|nicht|der|die|das|mit|für|bitte|wird|Gerät|Geräte|Wand|Raum|Grundriss|Ansicht)(?!\p{L})/u;
    expect(check("german", textsOf("en"), (t) => words.test(t.text))).toEqual([]);
  });

  it("German texts have no common English UI words left over", () => {
    const words = /(?<!\p{L})(Settings|Save|Cancel|Loading|Error|Open|Delete|Edit|Close|Search|Undo|Redo|Please|Click|Select|Show|Hide|the|and|with|your|you)(?!\p{L})/u;
    expect(check("english", textsOf("de"), (t) => words.test(t.text))).toEqual([]);
  });

  it("German texts write umlauts, not ae/oe/ue", () => {
    const translit = /\p{L}*(geraet|tuer|groess|hoehe|aender|loesch|oeffn|kuehl|spuel|fuer|ueber|waehl|zurueck|moeglich)\p{L}*/iu;
    expect(check("transliteration", textsOf("de"), (t) => translit.test(t.text))).toEqual([]);
  });
});
