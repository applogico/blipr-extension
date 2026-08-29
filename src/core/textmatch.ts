/**
 * Narrowing a watch by what an element says, on top of what the selector
 * matches by structure. `innerText` arrives full of the markup's newlines and
 * indentation, so both sides are collapsed to single spaces before comparing.
 */
export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Contains, not equals: real page text carries punctuation the user will not type. */
export function matchesText(elementText: string, filter: string): boolean {
  const needle = normalizeText(filter).toLowerCase();
  if (needle === "") return true;
  return normalizeText(elementText).toLowerCase().includes(needle);
}

export function countMatchingText(texts: string[], filter: string): number {
  return texts.filter((text) => matchesText(text, filter)).length;
}
