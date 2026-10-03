import { countMatchingText } from "./textmatch.js";

export type SelectorPick = {
  /** Matches only the element that was clicked. */
  unique: string;
  /** The same element's peers, when a useful generalization exists. */
  similar?: { selector: string; matches: number };
};

const MAX_DEPTH = 6;

/**
 * Class names a framework generated, which change on the site's next deploy.
 * A selector built on these looks right today and silently stops matching.
 */
function isStableClass(name: string): boolean {
  if (name.length > 40) return false;
  // Utility classes with variants or arbitrary values (`md:flex`, `w-[54px]`, `w-1/2`): layout, not identity.
  if (/[:[\]/!@%#()]/.test(name)) return false;
  if (/^[a-z]+-[a-z0-9]{6,}$/i.test(name)) return false; // emotion, styled-components
  if (/_[A-Za-z0-9]{5,}$/.test(name)) return false; // CSS modules
  if (/^[a-z0-9]{8,}$/i.test(name) && /\d/.test(name)) return false; // opaque hashes
  return true;
}

function classesOf(el: Element): string[] {
  return Array.from(el.classList).filter(isStableClass);
}

function escapeIdent(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
  return css?.escape ? css.escape(value) : value.replace(/([^\w-])/g, "\\$1");
}

function countMatches(root: ParentNode, selector: string): number {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

/** Attributes sites set on purpose to name an element, most deliberate first. */
const NAMING_ATTRIBUTES = [
  "data-testid",
  "data-test",
  "data-qa",
  "slot",
  "name",
  "aria-label",
  "role",
];

/** `[attr="value"]` for the first naming attribute worth keeping, if any. */
function namingAttribute(el: Element): string | null {
  for (const attr of NAMING_ATTRIBUTES) {
    const value = el.getAttribute(attr);
    if (value && value.length <= 40 && !/["\n\\]/.test(value)) return `[${attr}="${value}"]`;
  }
  return null;
}

/**
 * `tag[attr="value"]` when the element names itself, else `tag.class.class`:
 * the part of an element worth reusing on its peers, and short enough to sit
 * in the picker's hover label.
 */
export function shapeOf(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const named = namingAttribute(el);
  if (named) return `${tag}${named}`;
  return classesOf(el)
    .slice(0, 3)
    .reduce((sel, cls) => `${sel}.${escapeIdent(cls)}`, tag);
}

function nthOfType(el: Element): string {
  const parent = el.parentElement;
  if (!parent) return shapeOf(el);
  const peers = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  const index = peers.indexOf(el) + 1;
  return peers.length > 1 ? `${shapeOf(el)}:nth-of-type(${index})` : shapeOf(el);
}

/** An element's own id selector, when the id is one worth building on. */
function idSelector(el: Element | null): string | null {
  const id = el?.getAttribute("id");
  return id && isStableClass(id) ? `#${escapeIdent(id)}` : null;
}

/** The candidate on its own if that already matches only `el`, or anchored to an ancestor id. */
function narrowed(candidate: string, anchor: string | null, root: ParentNode): string | null {
  if (countMatches(root, candidate) === 1) return candidate;
  if (!anchor) return null;
  const anchored = `${anchor} > ${candidate}`;
  return countMatches(root, anchored) === 1 ? anchored : null;
}

/** The shortest selector this function can prove matches only `el`. */
export function uniqueSelector(el: Element, root: ParentNode = el.ownerDocument): string {
  const own = idSelector(el);
  if (own && countMatches(root, own) === 1) return own;

  const parts: string[] = [];
  let current: Element | null = el;
  for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
    parts.unshift(nthOfType(current));
    const found = narrowed(parts.join(" > "), idSelector(current.parentElement), root);
    if (found) return found;
    current = current.parentElement;
  }
  return parts.join(" > ");
}

/**
 * The clicked element's peers: its shape with every positional part dropped.
 * This is what a watch wants when a page has many of something — every
 * spinner on a CI run, not the third one.
 */
export function similarSelector(el: Element, root: ParentNode = el.ownerDocument): string | null {
  const shape = shapeOf(el);
  if (shape === el.tagName.toLowerCase()) return null; // a bare tag generalizes too far
  return countMatches(root, shape) > 1 ? shape : null;
}

export function pick(el: Element, root: ParentNode = el.ownerDocument): SelectorPick {
  const similar = similarSelector(el, root);
  return similar
    ? {
        unique: uniqueSelector(el, root),
        similar: { selector: similar, matches: countMatches(root, similar) },
      }
    : { unique: uniqueSelector(el, root) };
}

/** Count without throwing on a selector the user is still typing. */
export function tryCount(
  root: ParentNode,
  selector: string,
  containsText = "",
): { matches: number } | { error: string } {
  try {
    const found = Array.from(root.querySelectorAll(selector));
    return { matches: countMatchingText(found.map(visibleText), containsText) };
  } catch {
    return { error: "That is not a valid CSS selector." };
  }
}

/** `innerText` is what a reader sees. jsdom has none, where textContent is close enough. */
function ownText(el: Element): string {
  if ("innerText" in el && typeof el.innerText === "string") return el.innerText;
  return el.textContent;
}

const MAX_SHADOW_NODES = 200;

/**
 * What a reader sees, including inside open shadow roots: on web-component sites
 * (Reddit's sort menu) the visible label lives there and `innerText` is empty.
 */
export function visibleText(el: Element): string {
  const parts = [ownText(el)];
  let budget = MAX_SHADOW_NODES;
  const visit = (node: Element): void => {
    if (budget <= 0) return;
    budget -= 1;
    for (const child of Array.from(node.shadowRoot?.children ?? [])) {
      if (child.tagName === "STYLE" || child.tagName === "SLOT") continue;
      parts.push(ownText(child));
      visit(child);
    }
    for (const child of Array.from(node.children)) visit(child);
  };
  visit(el);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
