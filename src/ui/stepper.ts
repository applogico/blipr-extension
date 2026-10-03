import { el } from "./dom.js";

export type Bounds = { min: number; max: number; step: number };

/** One press up or down, snapped to the step and kept inside the bounds. */
export function stepValue(value: number, direction: 1 | -1, bounds: Bounds): number {
  const base = Number.isFinite(value) ? value : bounds.min;
  const snapped =
    direction === 1
      ? Math.floor((base - bounds.min) / bounds.step) * bounds.step + bounds.min + bounds.step
      : Math.ceil((base - bounds.min) / bounds.step) * bounds.step + bounds.min - bounds.step;
  return clampTo(snapped, bounds);
}

export function clampTo(value: number, { min, max }: Bounds): number {
  return Math.min(max, Math.max(min, value));
}

type StepperOptions = {
  label: string;
  value: number;
  bounds: Bounds;
  onChange: (value: number) => void;
};

/** Minus, the value, plus. The value is announced as it changes. */
export function stepper({ label, value, bounds, onChange }: StepperOptions): HTMLElement {
  let current = clampTo(value, bounds);
  const output = el("output", { className: "val", textContent: String(current) });
  output.setAttribute("aria-live", "polite");
  const minus = stepButton("−", `Less ${label.toLowerCase()}`);
  const plus = stepButton("+", `More ${label.toLowerCase()}`);
  const sync = () => {
    output.textContent = String(current);
    minus.disabled = current <= bounds.min;
    plus.disabled = current >= bounds.max;
  };
  const press = (direction: 1 | -1) => () => {
    current = stepValue(current, direction, bounds);
    sync();
    onChange(current);
  };
  minus.addEventListener("click", press(-1));
  plus.addEventListener("click", press(1));
  sync();
  const group = el("div", { className: "stepper" }, [minus, output, plus]);
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  return group;
}

function stepButton(text: string, label: string): HTMLButtonElement {
  const button = el("button", { type: "button", textContent: text });
  button.setAttribute("aria-label", label);
  return button;
}
