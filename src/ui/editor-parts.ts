import { attrs, el } from "./dom.js";
import { hostOfServer } from "./text.js";

export type Screen = "main" | "more" | "pages";
export type Field = HTMLElement;

let ids = 0;

/** A text input that reports every keystroke, with an id a label can point at. */
export function textInput(
  name: string,
  value: string,
  onInput: (value: string) => void,
): HTMLInputElement {
  ids += 1;
  const input = el("input", { type: "text", name, value, id: `${name}-${ids}` });
  input.addEventListener("input", () => {
    onInput(input.value);
  });
  return input;
}

export function field(children: HTMLElement[]): HTMLElement {
  return el("div", { className: "field" }, children);
}

/** "Sending to blipr.dev. Change": where blips go, with a way to Settings when the host offers one. */
export function serverLine(server: string, onOpenSettings?: () => void): HTMLElement {
  const line = el("p", { className: "hint server-line" }, [`Sending to ${hostOfServer(server)}.`]);
  if (onOpenSettings) {
    const change = el("button", {
      type: "button",
      className: "link-btn",
      textContent: "Change in Settings",
    });
    change.addEventListener("click", onOpenSettings);
    line.append(" ", change);
  }
  return line;
}

export function screenHeader(title: string, onBack: () => void): HTMLElement {
  const back = el("button", { type: "button", className: "iconbtn", textContent: "Back" });
  back.addEventListener("click", onBack);
  return el("header", { className: "screen-hd" }, [
    back,
    el("h1", { className: "brand grow", textContent: title }),
  ]);
}

export function switchRow(title: string, line: HTMLElement, control: HTMLElement): HTMLElement {
  return el("div", { className: "row" }, [
    el("div", { className: "grow" }, [
      el("span", { className: "t-strong", textContent: title }),
      line,
    ]),
    control,
  ]);
}

export function hint(text: string): HTMLElement {
  return el("p", { className: "hint", textContent: text });
}

export function hidden<T extends Element>(node: T): T {
  return attrs(node, { "aria-hidden": "true" });
}
