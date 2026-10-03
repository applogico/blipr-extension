// Click-to-pick, in the page. The click is swallowed in the capture phase so
// the page underneath never sees it, and Escape or Cancel takes every listener
// and node back out again. The overlay lives in a shadow root under a custom
// tag, so the page's styles cannot reach it and no page selector matches it.
import type { SelectorPick } from "../core/selector.js";
import type { Layer } from "../core/layers.js";
import { firstUseful, stepLayer } from "../core/layers.js";
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

const HOST_STYLE: Array<[string, string]> = [
  ["display", "block"],
  ["visibility", "visible"],
  ["opacity", "1"],
  ["position", "static"],
  ["contain", "none"],
  ["filter", "none"],
  ["transform", "none"],
];

type Overlay = { host: HTMLElement; box: HTMLElement; tip: HTMLElement; cancel: HTMLElement };

let overlay: Overlay | null = null;
let hovered: Element | null = null;
// Everything under the pointer, topmost first, and which one is outlined.
let layers: Element[] = [];
let layerIndex = 0;
// Elements ↑ climbed out of, so ↓ can come back down.
let lifted: Element[] = [];
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
  // Pages hide undefined custom elements (Reddit: :not(:defined)); inline !important wins.
  for (const [name, value] of HOST_STYLE) host.style.setProperty(name, value, "important");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  const layer = node("div", "layer");
  const box = node("div", "box");
  const tip = node("div", "tip");
  const bar = node("div", "bar");
  const kbd = node("kbd", "", "Esc");
  const cancel = node("button", "", "Cancel");
  bar.append(
    "Click the element to watch",
    node("kbd", "", "↑"),
    "Bigger",
    node("kbd", "", "Tab"),
    "Next layer",
    kbd,
    cancel,
  );
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
  layers = [];
  layerIndex = 0;
  lifted = [];
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
  if (!(event instanceof MouseEvent) || !overlay) return;
  const host = overlay.host;
  const stack = document
    .elementsFromPoint(event.clientX, event.clientY)
    .filter((el) => el !== host && el !== document.documentElement && el !== document.body);
  layers = stack;
  layerIndex = firstUseful(stack.map(describe));
  lifted = [];
  const chosen = stack[layerIndex];
  if (chosen) setHovered(chosen);
}

function setHovered(el: Element): void {
  if (el === hovered) return;
  hovered = el;
  schedule();
}

/** Measures one layer for the cover check in core/layers. */
function describe(el: Element): Layer {
  const rect = el.getBoundingClientRect();
  return { hasContent: showsSomething(el), area: rect.width * rect.height };
}

const MEDIA = "img, svg, video, canvas, picture, iframe, input, textarea, select";

/** Visible text or media, ignoring screen-reader-only text clipped to a pixel. */
function showsSomething(el: Element): boolean {
  if (el.matches(MEDIA)) return true;
  return hasVisibleBox(Array.from(el.querySelectorAll(MEDIA)).slice(0, 20)) || hasVisibleText(el);
}

function hasVisibleText(el: Element): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let seen = 0; seen < 50; seen += 1) {
    const text = walker.nextNode();
    if (!text) return false;
    if (!text.textContent?.trim()) continue;
    range.selectNodeContents(text);
    // Screen-reader-only text overflows a 1px clipped box, so its container must be visible too.
    const holder = text.parentElement;
    if (!holder || !isVisibleBox(holder.getBoundingClientRect())) continue;
    if (isVisibleBox(range.getBoundingClientRect())) return true;
  }
  return false;
}

function isVisibleBox(box: DOMRect): boolean {
  return box.width > 2 && box.height > 2;
}

function hasVisibleBox(elements: Element[]): boolean {
  return elements.some((el) => isVisibleBox(el.getBoundingClientRect()));
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
  // The outlined element, which may sit under a cover or be one ↑ climbed to.
  const target = hovered ?? event.target;
  if (!(target instanceof Element) || target === current?.host) return;
  const send = report;
  // Tear down first, so the overlay is never part of what the selector is built from.
  disarm();
  if (send) send(pick(target));
}

function onKey(event: Event): void {
  if (!(event instanceof KeyboardEvent)) return;
  const action = KEYS[event.key];
  if (!action) return;
  swallow(event);
  action(event);
}

const KEYS: Record<string, (event: KeyboardEvent) => void> = {
  Escape: () => {
    disarm();
  },
  Tab: (event) => {
    nextLayer(event.shiftKey);
  },
  ArrowUp: () => {
    climb();
  },
  ArrowDown: () => {
    descend();
  },
};

/** Tab: the next element stacked under the pointer. */
function nextLayer(backwards: boolean): void {
  if (layers.length === 0) return;
  layerIndex = stepLayer(layerIndex, layers.length, backwards);
  lifted = [];
  const next = layers[layerIndex];
  if (next) setHovered(next);
}

/** ↑: the element around the outlined one. */
function climb(): void {
  const parent = hovered?.parentElement;
  if (!hovered || !parent || parent === document.body || parent === document.documentElement)
    return;
  lifted.push(hovered);
  setHovered(parent);
}

/** ↓: back to what ↑ climbed out of. */
function descend(): void {
  const back = lifted.pop();
  if (back) setHovered(back);
}

function swallow(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
