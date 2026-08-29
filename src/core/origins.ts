/**
 * Host access is optional and asked for one watch at a time, so a URL pattern
 * has to become a match pattern the browser will accept: scheme, host, `/*`.
 * A match pattern cannot carry a port, so a port widens to the whole host.
 */
export function originPattern(urlPattern: string): string | null {
  const trimmed = urlPattern.trim();
  const anyScheme = trimmed.startsWith("*://");
  const url = parse(anyScheme ? `https://${trimmed.slice(4)}` : trimmed);
  if (!url) return null;
  if (!anyScheme && !["http:", "https:"].includes(url.protocol)) return null;
  if (!isHostPattern(url.hostname)) return null;
  return `${anyScheme ? "*" : url.protocol.slice(0, -1)}://${url.hostname}/*`;
}

/** The host a match pattern covers, for saying out loud which site is being asked for. */
export function hostOf(pattern: string): string {
  return pattern.split("://")[1]?.split("/")[0] ?? pattern;
}

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** `*` stands for any host, and `*.` for any subdomain. Anywhere else it is not a host. */
function isHostPattern(host: string): boolean {
  if (host === "*") return true;
  const rest = host.startsWith("*.") ? host.slice(2) : host;
  return rest.length > 0 && !rest.includes("*");
}
