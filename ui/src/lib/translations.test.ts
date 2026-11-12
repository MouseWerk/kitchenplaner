// The translation check (design/writing.md): de.ts and en.ts have the same keys, no empty texts,
// the same placeholders and plural shape per key, no emoji, no space before an ellipsis, no straight
// quotes or apostrophes, the glossary (docs/i18n.md) is kept, one term per concept in both
// languages, German says "du", no German is left in English texts, and every key is used by the
// app. True exceptions go into ALLOWED with the reason.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { de, type Msg } from "../locales/de";
import { en } from "../locales/en";

type Lang = "de" | "en";
type Text = { key: string; where: string; lang: Lang; text: string };

/** A finding of `rule` at `where` (a key, or `key.one`/`key.other`) that is accepted. */
const ALLOWED: { rule: string; where: string; reason: string }[] = [
  { rule: "one-term", where: "view3d.face.back", reason: "„Hinten“, the back face of the view cube, and „Zurück“, going back, are both “Back” in English." },
  { rule: "one-term", where: "list.cold", reason: "The equipment list’s water cell says „KW“ and “Cold”; the code of a cold water point is „KW“ and “CW”." },
  { rule: "one-term", where: "list.hot", reason: "The equipment list’s water cell says „WW“ and “Hot”; the code of a hot water point is „WW“ and “HW”." },
  { rule: "glossary", where: "catDesc.donerGrill", reason: "A „senkrechter Drehspieß“ is the vertical spit itself, not a direction on the drawing." },
];
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
    expect(check("emoji", all, (t) => /\p{Extended_Pictographic}|\u{FE0F}/u.test(t.text.replace(/[©®™]/g, "")))).toEqual([]);
  });

  it("puts the ellipsis right after the word, as one character", () => {
    expect(check("ellipsis", all, (t) => /\s…/.test(t.text) || /\.\.\./.test(t.text))).toEqual([]);
  });

  it("uses typographic quotes and apostrophes in each language", () => {
    expect(check("quotes", all, (t) => /"/.test(t.text))).toEqual([]);
    // „Los geht’s“, “manufacturer’s”: the apostrophe is ’, never '.
    expect(check("apostrophe", all, (t) => /'/.test(t.text))).toEqual([]);
    // German „…“, English “…”.
    expect(check("quotes", textsOf("en"), (t) => /„/.test(t.text))).toEqual([]);
    expect(check("quotes", textsOf("de"), (t) => /”/.test(t.text))).toEqual([]);
  });
});

describe("glossary and leftovers", () => {
  it("German texts say „Computer“, not „Rechner“", () => {
    expect(check("glossary", textsOf("de"), (t) => /rechner/i.test(t.text))).toEqual([]);
  });

  // Terms the glossary (docs/i18n.md) decided against, with the term to use instead.
  const AVOID: { lang: Lang; avoid: string; term: RegExp; use: string }[] = [
    { lang: "de", avoid: "Aufschlagrichtung", term: /Aufschlagrichtung/, use: "Öffnungsrichtung" },
    { lang: "de", avoid: "Wandansicht", term: /Wandansicht/, use: "Ansicht" },
    { lang: "de", avoid: "Aufriss", term: /Aufriss/, use: "Ansicht" },
    { lang: "de", avoid: "waagrecht/senkrecht", term: /(?<!\p{L})(waagrecht|senkrecht)/iu, use: "horizontal/vertikal" },
    { lang: "en", avoid: "catalog", term: /(?<!\p{L})catalog(?!ue)/iu, use: "catalogue" },
    { lang: "en", avoid: "American spelling", term: /(?<!\p{L})(colors?|centers?|liters?|meters?)(?!\p{L})/iu, use: "British spelling" },
  ];
  for (const a of AVOID) {
    it(`${a.lang === "de" ? "German" : "English"} texts say ${a.use}, not ${a.avoid}`, () => {
      expect(check("glossary", textsOf(a.lang), (t) => a.term.test(t.text))).toEqual([]);
    });
  }

  it("use one term per concept: the same text in one language is the same text in the other", () => {
    // Two keys with the same German text and different English texts (or the other way round) are
    // one concept named twice, or two concepts sharing a name.
    const bad: string[] = [];
    for (const [from, to] of [["de", "en"], ["en", "de"]] as const) {
      const byText = new Map<string, string[]>();
      for (const [key, msg] of Object.entries(catalogs[from])) if (typeof msg === "string") byText.set(msg, [...(byText.get(msg) ?? []), key]);
      for (const [text, keys] of byText) {
        const shown = keys.filter((k) => !allowed("one-term", k));
        const other = new Set(shown.map((k) => JSON.stringify(catalogs[to][k])));
        if (other.size > 1) bad.push(`${from} „${text}“: ${shown.map((k) => `${k} = ${JSON.stringify(catalogs[to][k])}`).join(", ")}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("German texts say „du“, not „Sie“", () => {
    // „Sie“ starting a sentence may be „it“ or „they“; inside a sentence and „Ihnen“ it is formal.
    const formal = /(?<![.!?:]\s|^)(?<!\p{L})(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?!\p{L})|(?<!\p{L})Ihnen(?!\p{L})/u;
    expect(check("formal", textsOf("de"), (t) => formal.test(t.text))).toEqual([]);
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

describe("keys", () => {
  // The app's sources without the catalogs and the tests: a key only a test uses is dead text.
  const root = resolve(__dirname, "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "locales" ? [] : sources(join(dir, e.name))) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [readFileSync(join(dir, e.name), "utf8")] : [],
    );
  const code = sources(root).join("\n");
  // Keys written out in quotes, and the fixed start of keys built at run time (`facing.${f}`).
  const literal = new Set([...code.matchAll(/["'`]([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)["'`]/g)].map((m) => m[1]));
  const prefixes = [...new Set([...code.matchAll(/`([A-Za-z][A-Za-z0-9]*\.[A-Za-z0-9.]*)\$\{/g)].map((m) => m[1]))];

  it("are all used by the app", () => {
    const unused = Object.keys(de).filter((k) => !literal.has(k) && !prefixes.some((p) => k.startsWith(p)) && !allowed("unused", k));
    expect(unused).toEqual([]);
  });
});
