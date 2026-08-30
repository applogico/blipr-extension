/**
 * When a watch is due for a timed reload.
 *
 * One alarm ticks for every watch, and the worker is gone between ticks, so a
 * watch decides for itself from stored state: how often it wants a reload and
 * when it last got one. A disabled watch — which is what a spent fire-once
 * watch is — refreshes nothing.
 */
import type { Watch } from "./watch.js";

export type Refreshing = Pick<Watch, "enabled" | "refresh" | "refreshMinutes" | "lastRefreshedAt">;

type Scheduled = Refreshing & { refreshMinutes: number };

export function isRefreshing(watch: Refreshing): watch is Scheduled {
  return watch.enabled && watch.refresh === true && watch.refreshMinutes !== undefined;
}

export function isDue(watch: Refreshing, now: number): boolean {
  if (!isRefreshing(watch)) return false;
  const since = watch.lastRefreshedAt;
  return since === undefined || now - since >= watch.refreshMinutes * 60_000;
}

/** How often the one alarm has to tick: as often as the most frequent watch wants. */
export function tickMinutes(watches: Refreshing[]): number | null {
  const intervals = watches.filter(isRefreshing).map((watch) => watch.refreshMinutes);
  return intervals.length === 0 ? null : Math.min(...intervals);
}
