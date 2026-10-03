// Click-to-pick, in the page. The click is swallowed in the capture phase so
// the page underneath never sees it, and Escape or Cancel takes every listener
// and node back out again. The overlay lives in a shadow root under a custom
// tag, so the page's styles cannot reach it and no page selector matches it.
import type { SelectorPick } from "../core/selector.js";
import { pick } from "../core/selector.js";
import { matchesOnPage } from "../ui/text.js";

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
  font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
.box { position: fixed; display: none; border-radius: 4px;
  outline: 3px solid #4f46e5; outline-offset: 3px; background: rgba(79, 70, 229, 0.12); }
.tip { position: fixed; display: none; flex-direction: column; gap: 4px; max-width: 360px;
  padding: 11px 13px; border-radius: 10px; background: #181b23; color: #fff;
  box-shadow: 0 12px 28px rgba(16, 18, 24, 0.14), 0 4px 10px rgba(16, 18, 24, 0.08); }
.sel { font: 14px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; color: #67e8f9;
  overflow-wrap: anywhere; }
.count { color: #d6dae3; font-size: 13.5px; }
.bar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px;
  border-radius: 999px; background: #181b23; color: #fff; white-space: nowrap;
  box-shadow: 0 12px 28px rgba(16, 18, 24, 0.14), 0 4px 10px rgba(16, 18, 24, 0.08);
  pointer-events: auto; }
kbd { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2px 7px;
  border-radius: 5px; background: rgba(255, 255, 255, 0.18); }
button { font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  min-height: 36px; padding: 0 14px; border: 0; border-radius: 999px; background: #fff;
  color: #181b23; cursor: pointer; }
button:focus-visible { outline: 2px solid #a3a8fc; outline-offset: 2px; }
`;

type Overlay = { host: HTMLElement; box: HTMLElement; tip: HTMLElement; cancel: HTMLElement };

let overlay: Overlay | null = null;
let hovered: Element | null = null;
let frame = 0;
let report: ((picked: SelectorPick) => void) | null = null;

export function arm(onPick: (picked: SelectorPick) => void): void {
  if (overlay) return;
  report = onPick;
  overlay = build();
  document.documentElement.append(overlay.host);
  document.documentElement.style.setProperty("cursor", "crosshair", "important");
  listen(true);
}

function build(): Overlay {
  const host = document.createElement("blipr-picker");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  const layer = node("div", "layer");
  const box = node("div", "box");
  const tip = node("div", "tip");
  const bar = node("div", "bar");
  const kbd = node("kbd", "", "Esc");
  const cancel = node("button", "", "Cancel");
  bar.append("Click the element to watch", kbd, cancel);
  layer.append(box, tip, bar);
  root.append(style, layer);
  return { host, box, tip, cancel };
}

function node(tag: string, className: string, text = ""): HTMLElement {
  const created = document.createElement(tag);
  created.className = className;
  created.textContent = text;
  return created;
}

function disarm(): void {
  listen(false);
  cancelAnimationFrame(frame);
  document.documentElement.style.removeProperty("cursor");
  overlay?.host.remove();
  overlay = null;
  hovered = null;
  report = null;
}

const LISTENERS: Array<[string, (event: Event) => void]> = [
  ["mousemove", onMove],
  ["mousedown", swallow],
  ["mouseup", swallow],
  ["click", onClick],
  ["keydown", onKey],
  ["scroll", schedule],
];

function listen(on: boolean): void {
  for (const [type, handler] of LISTENERS) {
    if (on) window.addEventListener(type, handler, true);
    else window.removeEventListener(type, handler, true);
  }
}

function onMove(event: Event): void {
  const target = event.target instanceof Element ? event.target : null;
  if (target === overlay?.host) return;
  if (target === hovered) return;
  hovered = target;
  schedule();
}

/** Building a selector queries the page, so it happens at most once a frame. */
function schedule(): void {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

function draw(): void {
  if (!overlay || !hovered) return;
  const rect = hovered.getBoundingClientRect();
  place(overlay.box, rect);
  const picked = pick(hovered);
  const selector = picked.similar?.selector ?? picked.unique;
  overlay.tip.replaceChildren(
    node("span", "sel", selector),
    node("span", "count", matchesOnPage(picked.similar?.matches ?? 1)),
  );
  overlay.tip.style.display = "flex";
  placeTip(overlay.tip, rect);
}

function place(box: HTMLElement, rect: DOMRect): void {
  box.style.display = "block";
  box.style.top = `${rect.top}px`;
  box.style.left = `${rect.left}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

/** Below the element when there is room, above it otherwise, always on screen. */
function placeTip(tip: HTMLElement, rect: DOMRect): void {
  const gap = 12;
  const { width, height } = tip.getBoundingClientRect();
  const below = rect.bottom + gap + height < window.innerHeight - 72;
  const top = below ? rect.bottom + gap : Math.max(8, rect.top - gap - height);
  const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}

function onClick(event: Event): void {
  swallow(event);
  const current = overlay;
  if (current && event.composedPath().includes(current.cancel)) {
    disarm();
    return;
  }
  const target = event.target;
  if (!(target instanceof Element) || target === current?.host) return;
  const send = report;
  // Tear down first, so the overlay is never part of what the selector is built from.
  disarm();
  if (send) send(pick(target));
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
