// A connection check is one GET to the health route on the same `/blip` scope
// a publish goes through, so a pass means a blip has a road to travel.
import type { ConnectionCheck } from "../storage.js";

export const CHECK_TIMEOUT_MS = 8_000;
/** How long a popup trusts the last answer before asking again. */
export const CHECK_STALE_MS = 10 * 60_000;

export function healthUrl(server: string): string {
  return `${server.trim().replace(/\/+$/, "")}/blip/health-check`;
}

/** The newest answer, keeping when the server last said yes. */
export function nextCheck(
  previous: ConnectionCheck | null,
  server: string,
  ok: boolean,
  at: number,
): ConnectionCheck {
  if (ok) return { server, ok, at, lastOkAt: at };
  const lastOkAt = previous?.server === server ? previous.lastOkAt : undefined;
  return lastOkAt === undefined ? { server, ok, at } : { server, ok, at, lastOkAt };
}

export function isStale(check: ConnectionCheck | null, server: string, now: number): boolean {
  return !check || check.server !== server || now - check.at > CHECK_STALE_MS;
}
