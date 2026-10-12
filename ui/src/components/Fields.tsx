// Form controls of the inspector. Number and text fields apply on Enter or when they lose focus
// (every change is one undo step); Escape restores the shown value.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { currentLang, num, type Lang } from "../lib/i18n";

export function Field(props: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={props.wide ? "field wide" : "field"}>
      <label htmlFor={id}>{props.label}</label>
      {props.children(id)}
    </div>
  );
}

/** Digits grouped by thousands with `sep`, as `num` shows them ("1.200", "12,345,678"). */
const grouped = (s: string, sep: "." | ",") => (sep === "." ? /^-?\d{1,3}(\.\d{3})+$/ : /^-?\d{1,3}(,\d{3})+$/).test(s);

/**
 * Parses a number as `num` shows it in `lang` ("1.200,5" in German, "1,200.5" in English), so the
 * shown text reads back as the same value. The other style is accepted where it is unambiguous: with
 * both separators the last one is the decimal point, and a lone separator that cannot be thousands
 * grouping ("0.5" in German, "0,5" in English) is the decimal point.
 */
export function parseNumber(text: string, lang: Lang = currentLang()): number | null {
  let s = text.trim().replace(/\s|mm$/gi, "");
  if (!s) return null;
  const [dec, group]: [string, "." | ","] = lang === "de" ? [",", "."] : [".", ","];
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const last = comma > dot ? "," : ".";
    const other = last === "," ? "." : ",";
    s = s.split(other).join("");
    if (s.indexOf(last) !== s.lastIndexOf(last)) return null;
    s = s.replace(last, ".");
  } else if (s.includes(group) && grouped(s, group)) s = s.split(group).join("");
  else if (s.includes(dec) || s.includes(group)) {
    const sep = s.includes(dec) ? dec : group;
    if (s.indexOf(sep) !== s.lastIndexOf(sep)) return null;
    s = s.replace(sep, ".");
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  unit?: string;
  disabled?: boolean;
}) {
  const { value, digits = 0 } = props;
  const show = (v: number) => num(v, digits);
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);
  // Escape blurs the field, and blur commits the typed text unless this is set.
  const cancelled = useRef(false);
  useEffect(() => {
    if (!editing) setText(show(value));
  }, [value, editing, digits]);

  const commit = (raw: string) => {
    // The untouched shown text is rounded to `digits`; reading it back must not change the value.
    if (raw === show(value)) {
      setText(raw);
      return;
    }
    const v = parseNumber(raw);
    if (v === null) {
      setText(show(value));
      return;
    }
    commitValue(v);
  };

  const commitValue = (v: number) => {
    const clamped = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, v));
    if (clamped !== value) props.onChange(clamped);
    setText(show(clamped));
  };

  return (
    <Field label={props.label}>
      {(id) => (
        <div className="num-input">
          <input
            id={id}
            inputMode="decimal"
            value={text}
            disabled={props.disabled}
            onFocus={(e) => {
              cancelled.current = false;
              setEditing(true);
              e.currentTarget.select();
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              setEditing(false);
              if (cancelled.current) {
                cancelled.current = false;
                setText(show(value));
              } else commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              else if (e.key === "Escape") {
                cancelled.current = true;
                (e.target as HTMLInputElement).blur();
                e.stopPropagation();
              } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const step = (props.step ?? 1) * (e.shiftKey ? 10 : 1);
                const typed = text === show(value) ? value : parseNumber(text);
                commitValue((typed ?? value) + (e.key === "ArrowUp" ? step : -step));
              }
            }}
          />
          {props.unit && <span className="unit">{props.unit}</span>}
        </div>
      )}
    </Field>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; type?: "text" | "date"; multiline?: boolean }) {
  const [text, setText] = useState(props.value);
  useEffect(() => setText(props.value), [props.value]);
  const commit = () => {
    if (text !== props.value) props.onChange(text);
  };
  return (
    <Field label={props.label} wide={props.wide}>
      {(id) =>
        props.multiline ? (
          <textarea id={id} value={text} rows={3} onChange={(e) => setText(e.target.value)} onBlur={commit} />
        ) : (
          <input
            id={id}
            type={props.type ?? "text"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              else if (e.key === "Escape") {
                setText(props.value);
                e.stopPropagation();
              }
            }}
          />
        )
      }
    </Field>
  );
}

export function SelectField<T extends string | number>(props: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Field label={props.label}>
      {(id) => (
        <select
          id={id}
          value={String(props.value)}
          onChange={(e) => {
            const o = props.options.find((x) => String(x.value) === e.target.value);
            if (o) props.onChange(o.value);
          }}
        >
          {props.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckField(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}
