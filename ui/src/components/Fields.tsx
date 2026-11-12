// Form controls of the inspector. Number and text fields apply on Enter or when they lose focus
// (every change is one undo step); Escape restores the shown value. Enter keeps the focus in the
// field, so the keyboard user goes on from there. Keys that confirm a composition (an input
// method's Enter) are the composition's, not the field's.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { currentLang, formatDate, num, parseDate, useT, type Lang } from "../lib/i18n";

/** A titled section of the inspector; `actions` sit at the end of the heading line. */
export function Section(props: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="insp-section">
      <div className="insp-section-head">
        <h3 className="eyebrow" tabIndex={-1}>{props.title}</h3>
        {props.actions}
      </div>
      {props.children}
    </section>
  );
}

/** `set` marks a value the planner set over a derived one (by text weight, see app.css). */
export function Field(props: { label: string; children: (id: string) => ReactNode; wide?: boolean; set?: boolean }) {
  const id = useId();
  return (
    <div className={`field${props.wide ? " wide" : ""}${props.set ? " is-set" : ""}`}>
      {/* A narrow inspector cuts long labels; the tooltip keeps the whole name. */}
      <label htmlFor={id} title={props.label}>
        {props.label}
      </label>
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
  // The typographic minus (U+2212) is what word processors and macOS often insert for "-".
  let s = text.trim().replace(/\s|mm$/gi, "").replace(/−/g, "-");
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
  // Plain decimals only: `Number` would also read "0x10", "1e3" or "Infinity".
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Whether the key event belongs to an input method's composition (Enter picks a candidate there). */
const composing = (e: React.KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229;

interface NumberLimits {
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  unit?: string;
  disabled?: boolean;
}

export function NumberField(props: NumberLimits & { label: string; value: number; onChange: (v: number) => void }) {
  const { label, onChange, ...rest } = props;
  return <Field label={label}>{(id) => <NumberInput {...rest} id={id} onChange={(v) => v !== undefined && onChange(v)} />}</Field>;
}

/**
 * A number the planner may leave to a derived value: empty, the field shows `derived` as its
 * placeholder; a typed value overrides it and shows in a heavier weight; emptying the field gives
 * the value back to the derivation (`onChange(undefined)`). The arrow keys step from the derived
 * value. `placeholder` replaces the formatted derived value where it needs words („< 0,1“).
 */
export function OptionalNumberField(
  props: NumberLimits & { label: string; value: number | undefined; derived: number | undefined; placeholder?: string; onChange: (v: number | undefined) => void; wide?: boolean },
) {
  const { label, wide, ...rest } = props;
  return (
    <Field label={label} wide={wide} set={props.value !== undefined}>
      {(id) => <NumberInput {...rest} id={id} optional set={props.value !== undefined} />}
    </Field>
  );
}

/**
 * The input of a number field, also on its own where one label names several inputs (then
 * `ariaLabel` names each). Without `optional` the value is always a number.
 */
export function NumberInput(
  props: NumberLimits & {
    id?: string;
    ariaLabel?: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    optional?: boolean;
    derived?: number;
    placeholder?: string;
    /** The value is the planner's, over a derived one: shown in a heavier weight. */
    set?: boolean;
  },
) {
  const { value, digits = 0 } = props;
  // Re-renders on a language switch: the shown text must follow it, or leaving the field would
  // read "3.200" (German) by English rules as 3.2.
  useT();
  const lang = currentLang();
  const show = (v: number | undefined) => (v === undefined ? "" : num(v, digits));
  const [text, setText] = useState(show(value));
  // The text is the user's (typed since focus or since the last Enter), not the shown value.
  const [editing, setEditing] = useState(false);
  // Escape blurs the field, and blur commits the typed text unless this is set.
  const cancelled = useRef(false);
  useEffect(() => {
    if (!editing) setText(show(value));
  }, [value, editing, digits, lang]);

  const commit = (raw: string) => {
    // The untouched shown text is rounded to `digits`; reading it back must not change the value.
    if (raw === show(value)) {
      setText(raw);
      return;
    }
    if (props.optional && raw.trim() === "") {
      if (value !== undefined) props.onChange(undefined);
      setText("");
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
    <div className={props.set ? "num-input is-set" : "num-input"}>
      <input
        id={props.id}
        aria-label={props.ariaLabel}
        inputMode="decimal"
        value={text}
        placeholder={props.optional ? (props.placeholder ?? show(props.derived)) : undefined}
        disabled={props.disabled}
        onFocus={(e) => {
          cancelled.current = false;
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setEditing(true);
          setText(e.target.value);
        }}
        onBlur={(e) => {
          setEditing(false);
          if (cancelled.current) {
            cancelled.current = false;
            setText(show(value));
          } else commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (composing(e)) return;
          if (e.key === "Enter") {
            commit(e.currentTarget.value);
            // The field shows the value again as the store holds it (clamped, rounded).
            setEditing(false);
          } else if (e.key === "Escape") {
            cancelled.current = true;
            (e.target as HTMLInputElement).blur();
            e.stopPropagation();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step = (props.step ?? 1) * (e.shiftKey ? 10 : 1);
            const typed = text === show(value) ? value : parseNumber(text);
            commitValue((typed ?? value ?? props.derived ?? 0) + (e.key === "ArrowUp" ? step : -step));
          }
        }}
      />
      {props.unit && <span className="unit">{props.unit}</span>}
    </div>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; multiline?: boolean }) {
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
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (composing(e)) return;
              if (e.key === "Enter") commit();
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

/**
 * A date (stored as ISO, "" for none) as a text field in the display language's format, not the
 * native date input, which follows the system locale instead of the app's language. Typed dates
 * are read tolerantly (`parseDate`); one that is no date puts the shown value back, as Escape does.
 */
export function DateField(props: { label: string; value: string; onChange: (v: string) => void }) {
  const t = useT();
  const shown = formatDate(props.value);
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => {
    if (!editing) setText(shown);
  }, [shown, editing]);

  const commit = (raw: string) => {
    if (raw === shown) return;
    const iso = parseDate(raw);
    if (iso === null) {
      setText(shown);
      return;
    }
    if (iso !== props.value) props.onChange(iso);
    setText(formatDate(iso));
  };

  return (
    <Field label={props.label}>
      {(id) => (
        <input
          id={id}
          type="text"
          className="date-input"
          inputMode="numeric"
          placeholder={t("field.datePlaceholder")}
          value={text}
          onFocus={() => {
            cancelled.current = false;
            setEditing(true);
          }}
          onChange={(e) => {
            setEditing(true);
            setText(e.target.value);
          }}
          onBlur={(e) => {
            setEditing(false);
            if (cancelled.current) {
              cancelled.current = false;
              setText(shown);
            } else commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (composing(e)) return;
            if (e.key === "Enter") {
              commit(e.currentTarget.value);
              setEditing(false);
            } else if (e.key === "Escape") {
              cancelled.current = true;
              (e.target as HTMLInputElement).blur();
              e.stopPropagation();
            }
          }}
        />
      )}
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

/**
 * A choice the planner may leave to a derived value: the first option is the derived one, labelled
 * `derivedLabel` and shown in the placeholder colour; picking any other option, even the same
 * value from the list, sets it (heavier weight). Picking the first option again gives the value
 * back to the derivation (`onChange(undefined)`). A set value missing from `options` (from a file)
 * is listed too, so the select can show it.
 */
export function OptionalSelectField<T extends string | number>(props: {
  label: string;
  value: T | undefined;
  derivedLabel: string;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  format: (v: T) => string;
}) {
  const options = props.value === undefined || props.options.some((o) => o.value === props.value) ? props.options : [...props.options, { value: props.value, label: props.format(props.value) }];
  return (
    <Field label={props.label} set={props.value !== undefined}>
      {(id) => (
        <select
          id={id}
          className={props.value === undefined ? "is-derived" : undefined}
          value={props.value === undefined ? "" : String(props.value)}
          onChange={(e) => {
            if (e.target.value === "") return props.onChange(undefined);
            const o = options.find((x) => String(x.value) === e.target.value);
            if (o) props.onChange(o.value);
          }}
        >
          <option value="">{props.derivedLabel}</option>
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckField(props: { label: string; checked: boolean; onChange: (v: boolean) => void; set?: boolean }) {
  return (
    <label className={props.set ? "check is-set" : "check"}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}
