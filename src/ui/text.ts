import type { Watch } from "../core/watch.js";

export function matchLabel(count: number): string {
  return `${count} element${count === 1 ? "" : "s"}`;
}

export function matchPhrase(count: number): string {
  return count > 0 ? `Matches ${matchLabel(count)} right now.` : "Nothing matches right now.";
}

export function conditionLabel(watch: Pick<Watch, "condition">): string {
  return watch.condition === "appears" ? "appears" : "is gone";
}

export function summaryLabel(watch: Watch): string {
  const parts = [conditionLabel(watch), `p${watch.priority}`, watch.once ? "once" : "every time"];
  if (watch.refresh) parts.push(`refresh ${refreshLabel(watch)}`);
  return parts.join(" · ");
}

/** How often a row says it reloads the page, on the badge and on the switch alike. */
export function refreshLabel(watch: Pick<Watch, "refreshMinutes">): string {
  return watch.refreshMinutes === undefined ? "off" : `every ${watch.refreshMinutes} min`;
}

export function statusText(watch: Watch, now = Date.now()): string {
  const parts: string[] = [];
  if (!watch.enabled) parts.push("Disabled");
  parts.push(latest(watch, now));
  const dropped = suppressedAt(watch);
  if (dropped !== undefined) parts.push(`Skipped a blip ${when(dropped, now)} (cooldown)`);
  return parts.join(" — ");
}

/** The error if there is one, else the last blip. */
function latest(watch: Watch, now: number): string {
  if (watch.enabled && watch.unsent) {
    return retrying(watch.lastErrorAt ?? watch.unsent.lastTriedAt);
  }
  if (watch.lastError) return watch.lastError;
  if (watch.lastFiredAt !== undefined) return `Blipped ${when(watch.lastFiredAt, now)}`;
  return "Waiting";
}

/** Only worth saying while the skip is newer than the blip that caused it. */
function suppressedAt(watch: Watch): number | undefined {
  const { lastSuppressedAt } = watch;
  if (lastSuppressedAt === undefined) return undefined;
  return lastSuppressedAt > (watch.lastFiredAt ?? 0) ? lastSuppressedAt : undefined;
}

function retrying(failedAt: number): string {
  return `Couldn't reach the server at ${clockTime(failedAt)}. Retrying.`;
}

export function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function when(timestamp: number, now: number): string {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return new Date(timestamp).toLocaleString();
}
