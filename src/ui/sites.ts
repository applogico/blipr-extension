// Which site a watch belongs to, whether its page is open, and which pages an
// extension is never allowed to read.
import { hostOf, originPattern } from "../core/origins.js";
import { matchesUrl, suggestPattern } from "../core/urlmatch.js";
import type { Watch } from "../core/watch.js";

/** Browsers keep extensions out of their stores, and their PDF viewer is not the page. */
const OFF_LIMITS_HOSTS = ["chromewebstore.google.com", "addons.mozilla.org"];

export function isWatchableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (OFF_LIMITS_HOSTS.includes(parsed.hostname)) return false;
  if (parsed.hostname === "chrome.google.com" && parsed.pathname.startsWith("/webstore")) {
    return false;
  }
  return !/\.pdf$/i.test(parsed.pathname);
}

/** What a group, a row and the site access list call a watch's site. */
export function siteOf(urlPattern: string): string {
  const origin = originPattern(urlPattern);
  return origin ? hostOf(origin) : urlPattern;
}

/** Paused means no open tab matches the watch's pattern. */
export function isOpen(urlPattern: string, openUrls: string[]): boolean {
  return openUrls.some((url) => matchesUrl(urlPattern, url));
}

/** A real address to open for a pattern: everything before its first wildcard. */
export function openableUrl(urlPattern: string): string | null {
  const trimmed = urlPattern.trim().replace(/^\*:\/\//, "https://");
  const head = trimmed.split("*")[0] ?? "";
  try {
    const url = new URL(head);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname === "") throw new Error();
    return url.href;
  } catch {
    const origin = originPattern(urlPattern);
    if (!origin) return null;
    return `https://${hostOf(origin).replace(/^\*\./, "")}/`;
  }
}

export type SiteGroup = { site: string; watches: Watch[] };

/** Watches grouped by site, in the order each site first appears. */
export function groupBySite(watches: Watch[]): SiteGroup[] {
  const groups = new Map<string, Watch[]>();
  for (const watch of watches) {
    const site = siteOf(watch.urlPattern);
    groups.set(site, [...(groups.get(site) ?? []), watch]);
  }
  return [...groups].map(([site, members]) => ({ site, watches: members }));
}

/** The page URL as the popup shows it: no scheme, no hash. */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.host}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

/** The whole site a pattern belongs to, as a pattern. */
export function wholeSitePattern(urlPattern: string): string | null {
  try {
    return `${new URL(urlPattern.replace(/\*.*$/, "")).origin}/*`;
  } catch {
    return null;
  }
}

/** The Pages to watch row's summary. */
export function pagesSummary(urlPattern: string, pageUrl?: string): string {
  if (pageUrl && urlPattern === suggestPattern(pageUrl)) return "This page and anything under it.";
  if (urlPattern === wholeSitePattern(urlPattern)) return "Every page on this site.";
  if (pageUrl && urlPattern === pageUrl) return "Only this exact page.";
  return urlPattern.endsWith("*") ? "Pages that start with this address." : "Only this address.";
}
