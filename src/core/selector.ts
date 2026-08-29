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

/**
 * `tag.class.class`: the part of an element worth reusing on its peers, and
 * short enough to sit in the picker's hover label.
 */
export function shapeOf(el: Element): string {
  const tag = el.tagName.toLowerCase();
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
  if (!shape.includes(".")) return null; // a bare tag generalizes too far
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
): { matches: number } | { error: string } {
  try {
    return { matches: root.querySelectorAll(selector).length };
  } catch {
    return { error: "That is not a valid CSS selector." };
  }
}
