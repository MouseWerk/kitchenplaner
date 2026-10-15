// The short introduction on the first start (lib/intro.ts): six steps from placing equipment to
// exporting, with the keys as this computer labels them, and a way into the example kitchen. A
// modal dialog: the focus stays inside it, Escape closes it and the focus goes back where it was.

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { confirmDiscard } from "../lib/actions";
import { cancelActiveOperator } from "../lib/commands";
import { currentLang, t, useT, type TKey } from "../lib/i18n";
import { closeIntro, showIntroOnFirstStart, useIntroOpen } from "../lib/intro";
import { keyLabel } from "../lib/shortcuts";
import { toast } from "../lib/toast";
import { useStore } from "../store/store";

interface Step {
  title: TKey;
  text: TKey;
  /** Keys with what they do; the key is a combo for `keyLabel`. */
  keys?: [string, TKey][];
}

export const INTRO_STEPS: Step[] = [
  { title: "intro.catalog.title", text: "intro.catalog.text" },
  { title: "intro.modes.title", text: "intro.modes.text", keys: [["Tab", "intro.key.mode"]] },
  {
    title: "intro.move.title",
    text: "intro.move.text",
    keys: [
      ["G", "intro.key.grab"],
      ["R", "intro.key.rotate"],
      ["X / Y", "intro.key.axis"],
      ["0–9", "intro.key.typed"],
      ["Enter", "intro.key.confirm"],
      ["Esc", "intro.key.cancel"],
    ],
  },
  { title: "intro.room.title", text: "intro.room.text" },
  {
    title: "intro.views.title",
    text: "intro.views.text",
    keys: [
      ["1 2 3 4", "intro.key.layouts"],
      ["F", "intro.key.fit"],
      ["M", "intro.key.measure"],
    ],
  },
  { title: "intro.export.title", text: "intro.export.text", keys: [["Mod+S", "intro.key.save"]] },
];

/** Opens the example kitchen in the display language, after the usual question about unsaved changes. */
export async function openExampleKitchen(): Promise<boolean> {
  cancelActiveOperator();
  if (!(await confirmDiscard())) return false;
  // Loaded when asked for: the example is built from the catalog, not shipped as a second file.
  const { exampleKitchen } = await import("../examples/exampleKitchen");
  const project = exampleKitchen(currentLang());
  useStore.getState().load(project, null);
  toast(t("file.opened", { name: project.info.name }));
  return true;
}

/**
 * The introduction; on the first start it opens once `ready` (the app holds it back while the
 * recovery dialog asks about backups, so two dialogs never stack).
 */
export function Intro({ ready = true }: { ready?: boolean }) {
  const open = useIntroOpen();
  useEffect(() => {
    if (ready) showIntroOnFirstStart();
  }, [ready]);
  return open ? <IntroDialog /> : null;
}

function IntroDialog() {
  const t = useT();
  const lang = currentLang();
  const [step, setStep] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const s = INTRO_STEPS[step];
  const last = step === INTRO_STEPS.length - 1;

  // Focus into the dialog, and back where it was when it closes.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [step]);

  const onKey = (e: React.KeyboardEvent) => {
    // The app's shortcuts stay out while the dialog is open.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      closeIntro();
    } else if (e.key === "Tab") {
      const items = [...(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [])];
      if (items.length === 0) return;
      const first = items[0];
      const end = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const example = async () => {
    if (await openExampleKitchen()) closeIntro();
  };

  return (
    <div className="intro-scrim" onPointerDown={(e) => e.target === e.currentTarget && closeIntro()}>
      <div ref={box} className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-text" onKeyDown={onKey}>
        <div className="intro-head">
          <div>
            <p className="eyebrow">{t("intro.progress", { n: step + 1, of: INTRO_STEPS.length })}</p>
            <h2 id="intro-title" className="intro-title">
              {t(s.title)}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={closeIntro} aria-label={t("common.close")} title={t("common.close")}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <p id="intro-text" className="intro-text">
          {t(s.text)}
        </p>
        {s.keys && (
          <dl className="intro-keys">
            {s.keys.map(([combo, what]) => (
              <div key={combo} className="intro-key">
                <dt>
                  <kbd>{keyLabel(combo, lang)}</kbd>
                </dt>
                <dd>{t(what)}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="intro-dots" aria-hidden>
          {INTRO_STEPS.map((_, i) => (
            <span key={i} className={i === step ? "intro-dot is-current" : "intro-dot"} />
          ))}
        </div>
        <div className="intro-foot">
          <button type="button" className="btn" onClick={() => void example()}>
            {t("intro.example")}
          </button>
          <span className="intro-spacer" />
          {step > 0 ? (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              {t("intro.back")}
            </button>
          ) : (
            <button type="button" className="btn" onClick={closeIntro}>
              {t("intro.skip")}
            </button>
          )}
          <button type="button" className="btn primary" data-autofocus onClick={() => (last ? closeIntro() : setStep(step + 1))}>
            {last ? t("intro.done") : t("intro.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
