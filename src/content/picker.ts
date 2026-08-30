// Click-to-pick, in the page. The click is swallowed in the capture phase so
// the page underneath never sees it, and Escape takes every listener and node
// back out again.
import type { SelectorPick } from "../core/selector.js";
import { pick, shapeOf } from "../core/selector.js";

const BOX_STYLE = [
  "position:fixed !important",
  "z-index:2147483647 !important",
  "pointer-events:none !important",
  "display:block !important",
  "margin:0 !important",
  "padding:0 !important",
  "border:0 !important",
  "outline:2px solid #3b5bfd !important",
  "background:rgba(59,91,253,0.12) !important",
].join(";");

const LABEL_STYLE = [
  "position:absolute !important",
  "top:0 !important",
  "left:0 !important",
  "max-width:100% !important",
  "padding:2px 6px !important",
  "background:#3b5bfd !important",
  "color:#ffffff !important",
  "font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace !important",
  "white-space:nowrap !important",
  "overflow:hidden !important",
  "text-overflow:ellipsis !important",
].join(";");

let box: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;
let hovered: Element | null = null;
let report: ((picked: SelectorPick) => void) | null = null;

export function arm(onPick: (picked: SelectorPick) => void): void {
  if (box) return;
  report = onPick;
  box = document.createElement("div");
  box.style.cssText = BOX_STYLE;
  label = document.createElement("div");
  label.style.cssText = LABEL_STYLE;
  box.append(label);
  document.documentElement.append(box);
  document.documentElement.style.setProperty("cursor", "crosshair", "important");
  listen(true);
}

function disarm(): void {
  listen(false);
  document.documentElement.style.removeProperty("cursor");
  box?.remove();
  box = null;
  label = null;
  hovered = null;
  report = null;
}

const LISTENERS: Array<[string, (event: Event) => void]> = [
  ["mousemove", onMove],
  ["mousedown", swallow],
  ["mouseup", swallow],
  ["click", onClick],
  ["keydown", onKey],
  ["scroll", draw],
];

function listen(on: boolean): void {
  for (const [type, handler] of LISTENERS) {
    if (on) window.addEventListener(type, handler, true);
    else window.removeEventListener(type, handler, true);
  }
}

function onMove(event: Event): void {
  hovered = event.target instanceof Element ? event.target : null;
  draw();
}

function draw(): void {
  if (!box || !label || !hovered) return;
  const rect = hovered.getBoundingClientRect();
  box.style.top = `${rect.top}px`;
  box.style.left = `${rect.left}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
  label.textContent = shapeOf(hovered);
}

function onClick(event: Event): void {
  swallow(event);
  const target = event.target;
  const send = report;
  // Tear down first: the overlay is a div, and would otherwise count as a match.
  disarm();
  if (send && target instanceof Element) send(pick(target));
}

function onKey(event: Event): void {
  if (!(event instanceof KeyboardEvent) || event.key !== "Escape") return;
  swallow(event);
  disarm();
}

function swallow(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
