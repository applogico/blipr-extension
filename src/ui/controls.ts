// The small pieces both pages build from: switches, segmented choices, pills,
// state lines and callouts.
import { attrs, el } from "./dom.js";
import type { Callout, Line, Pill, WatchState } from "./text.js";
import { PRIORITY_LABELS, priorityLabel } from "./text.js";

export function switchButton(
  label: string,
  on: boolean,
  onToggle: (next: boolean) => void,
): HTMLButtonElement {
  const button = attrs(el("button", { type: "button", className: "sw" }), {
    role: "switch",
    "aria-checked": String(on),
    "aria-label": label,
  });
  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-checked") !== "true";
    button.setAttribute("aria-checked", String(next));
    onToggle(next);
  });
  return button;
}

export type Choice = { value: string; label: string; small?: string };

type SegmentedOptions = {
  name: string;
  legend: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/** Real radios in a fieldset, so arrow keys and screen readers work as they should. */
export function segmented(options: SegmentedOptions): HTMLFieldSetElement {
  const { name, legend, choices, value, onChange, className = "" } = options;
  const seg = el(
    "div",
    { className: `seg ${className}`.trim() },
    choices.map((choice) => radio(name, choice, choice.value === value, onChange)),
  );
  return el("fieldset", { className: "field" }, [
    el("legend", { className: "label", textContent: legend }),
    seg,
  ]);
}

function radio(
  name: string,
  choice: Choice,
  checked: boolean,
  onChange: (value: string) => void,
): HTMLLabelElement {
  const input = el("input", { type: "radio", name, value: choice.value, checked });
  input.addEventListener("change", () => {
    if (input.checked) onChange(choice.value);
  });
  const small = choice.small ? [el("small", { textContent: choice.small })] : [];
  return el("label", {}, [input, el("span", { textContent: choice.label }), ...small]);
}

export const PRIORITY_CHOICES: Choice[] = PRIORITY_LABELS.map((label, index) => ({
  value: String(index + 1),
  label: String(index + 1),
  small: label,
}));

export function dot(state: WatchState | "on"): HTMLElement {
  const tone = state === "running" || state === "on" ? "" : ` ${state}`;
  return attrs(el("span", { className: `dot${tone}` }), { "aria-hidden": "true" });
}

export function priorityPill(priority: number): HTMLElement {
  return el("span", {
    className: `pri p${priority}`,
    textContent: priorityLabel(priority),
    title: `Priority ${priority}`,
  });
}

const LINE_CLASS = { plain: "sub", warn: "warn-line", bad: "err-line" } as const;

export function lineEl(line: Line): HTMLElement {
  return el("span", { className: LINE_CLASS[line.tone], textContent: line.text });
}

/** A line made of parts, where only some parts carry a tone. */
export function partsEl(lines: Line[]): HTMLElement {
  return el(
    "span",
    { className: "sub" },
    lines.map((line) =>
      line.tone === "plain"
        ? line.text
        : el("span", { className: `tone-${line.tone}`, textContent: line.text }),
    ),
  );
}

export function connectionPillEl(pill: Pill | null): HTMLElement | null {
  if (!pill) return null;
  return el("span", { className: pill.ok ? "conn" : "conn bad" }, [
    dot(pill.ok ? "on" : "error"),
    pill.text,
  ]);
}

export function calloutEl(kind: "warn" | "info" | "bad", callout: Callout): HTMLElement {
  const lead = kind === "warn" ? [dot("paused")] : [];
  return attrs(
    el("div", { className: `callout ${kind}` }, [
      ...lead,
      el("div", {}, [el("b", { textContent: callout.strong }), ` ${callout.rest}`]),
    ]),
    { role: kind === "info" ? "note" : "status" },
  );
}

export function markImg(src: string): HTMLImageElement {
  return el("img", { className: "mark", src, alt: "" });
}
