// Form controls of the inspector. Number and text fields apply on Enter or when they lose focus
// (every change is one undo step); Escape restores the shown value.

import { useEffect, useId, useState, type ReactNode } from "react";
import { num } from "../lib/i18n";

export function Field(props: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={props.wide ? "field wide" : "field"}>
      <label htmlFor={id}>{props.label}</label>
      {props.children(id)}
    </div>
  );
}

/** Parses a number typed in German or English style ("1.200,5", "1,200.5", "1200,5"). */
export function parseNumber(text: string): number | null {
  let s = text.trim().replace(/\s|mm$/gi, "");
  if (!s) return null;
  const comma = s.lastIndexOf(",");
  const dotAt = s.lastIndexOf(".");
  if (comma > dotAt) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
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
  useEffect(() => {
    if (!editing) setText(show(value));
  }, [value, editing, digits]);

  const commit = (raw: string) => {
    const v = parseNumber(raw);
    if (v === null) {
      setText(show(value));
      return;
    }
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
              setEditing(true);
              e.currentTarget.select();
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              setEditing(false);
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              else if (e.key === "Escape") {
                setText(show(value));
                setEditing(false);
                (e.target as HTMLInputElement).blur();
                e.stopPropagation();
              } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const step = (props.step ?? 1) * (e.shiftKey ? 10 : 1);
                const v = (parseNumber(text) ?? value) + (e.key === "ArrowUp" ? step : -step);
                commit(String(v));
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
