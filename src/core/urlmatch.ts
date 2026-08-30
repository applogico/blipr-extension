/** Turn a `*`-only glob into a whole-string matcher. */
export function matchesUrl(pattern: string, url: string): boolean {
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(url);
}

/** The pattern the popup offers for a page: this URL, minus its query and hash. */
export function suggestPattern(url: string): string {
  try {
    const parsed = new URL(url);
    // A non-web URL has no origin worth building a pattern from.
    if (!["http:", "https:"].includes(parsed.protocol)) return url;
    return `${parsed.origin}${parsed.pathname}*`;
  } catch {
    return url;
  }
}
