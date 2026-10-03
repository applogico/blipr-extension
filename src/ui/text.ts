// Every sentence the popup and the options page say about a watch, kept away
// from the DOM so each one can be tested on its own.
import type { Condition, Watch, WatchDraft } from "../core/watch.js";
import type { ConnectionCheck } from "../storage.js";

export type Tone = "plain" | "warn" | "bad";
export type Line = { text: string; tone: Tone };
export type WatchState = "running" | "paused" | "off" | "error";

export const PRIORITY_LABELS = ["Min", "Low", "Default", "High", "Max"] as const;

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority - 1] ?? "Default";
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function matchesOnPage(count: number): string {
  return count === 0
    ? "No matches on this page"
    : `${plural(count, "match", "matches")} on this page`;
}

/** How many of the selector's matches survive the text filter. */
export function filteredLine(filtered: number, total: number): string {
  const of = total === 1 ? "match" : "matches";
  if (filtered === 0) return `None of the ${total} ${of} has this text`;
  return `${filtered} of ${total} ${of} ${filtered === 1 ? "has" : "have"} this text`;
}

export function conditionPhrase(condition: Condition): string {
  return condition === "appears" ? "When it appears" : "When it's gone";
}

export function minutesPhrase(minutes: number): string {
  return minutes === 1 ? "minute" : `${minutes} minutes`;
}

/** 24-hour wall clock, the way the design writes times. */
export function clock(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DAY_MS = 86_400_000;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** When something happened, in lowercase, to sit inside a sentence. */
export function ago(timestamp: number, now: number): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  if (days === 0) return `at ${clock(timestamp)}`;
  if (days === 1) return `yesterday ${clock(timestamp)}`;
  if (days < 7) return `${days} days ago`;
  return `on ${new Date(timestamp).toLocaleDateString()}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function lastBlipLabel(watch: Pick<Watch, "lastFiredAt">, now: number): string {
  return watch.lastFiredAt === undefined ? "Not yet" : capitalize(ago(watch.lastFiredAt, now));
}

/** The stored error, in words a person would use. */
export function errorWords(watch: Pick<Watch, "lastError" | "lastErrorAt">): string {
  const error = watch.lastError ?? "";
  if (!/could not reach/i.test(error)) return error;
  const at = watch.lastErrorAt === undefined ? "" : ` at ${clock(watch.lastErrorAt)}`;
  return `Couldn't reach the server${at}`;
}

export function stateOf(watch: Watch, open: boolean): WatchState {
  if (!watch.enabled) return "off";
  if (watch.lastError) return "error";
  return open ? "running" : "paused";
}

/** A row on "On this page": the tab is open by definition. */
export function hereLine(watch: Watch, now: number): Line {
  if (watch.enabled && watch.lastError) return { text: errorWords(watch), tone: "bad" };
  const condition = conditionPhrase(watch.condition);
  if (!watch.enabled) return { text: `${condition}. Off.`, tone: "plain" };
  if (watch.lastFiredAt === undefined) return { text: `${condition}. Nothing yet.`, tone: "plain" };
  return { text: `${condition}. Last blip ${ago(watch.lastFiredAt, now)}.`, tone: "plain" };
}

/** A row under "Other watches": which site, then what it is doing. */
export function otherLine(watch: Watch, site: string, open: boolean, now: number): Line {
  const state = stateOf(watch, open);
  if (state === "error") return { text: `${site}. ${sentence(errorWords(watch))}`, tone: "bad" };
  if (state === "paused") return { text: `${site}. Paused, no tab open.`, tone: "warn" };
  if (state === "off") return { text: `${site}. Off.`, tone: "plain" };
  const fired = watch.lastFiredAt;
  const last = fired === undefined ? "" : `, last blip ${ago(fired, now)}`;
  return { text: `${site}. Running${last}.`, tone: "plain" };
}

/** The options table's second line under the selector. */
export function optionsLine(watch: Watch, open: boolean): Line {
  const state = stateOf(watch, open);
  if (state === "error") return { text: errorWords(watch), tone: "bad" };
  if (state === "paused") return { text: "Paused until the page is open.", tone: "warn" };
  const base = `${conditionPhrase(watch.condition)}, ${watch.once ? "once" : "every time"}.`;
  const reload = refreshing(watch);
  return {
    text: reload === null ? base : `${base} Reloads every ${minutesPhrase(reload)}.`,
    tone: "plain",
  };
}

function refreshing(watch: Pick<Watch, "refresh" | "refreshMinutes">): number | null {
  return watch.refresh && watch.refreshMinutes !== undefined ? watch.refreshMinutes : null;
}

const STATE_WORDS: Array<[WatchState, (count: number) => string, Tone]> = [
  ["running", (n) => `${n} running`, "plain"],
  ["paused", (n) => `${n} paused`, "warn"],
  ["error", (n) => (n === 1 ? "1 with an error" : `${n} with errors`), "bad"],
  ["off", (n) => `${n} off`, "plain"],
];

const ALL_WORDS: Record<WatchState, string> = {
  running: "running",
  paused: "paused",
  error: "with errors",
  off: "off",
};

/** The closed group's one line: "2 more: 1 running, 1 paused". */
export function groupSummary(states: WatchState[]): Line[] {
  const total = states.length;
  const counted = STATE_WORDS.map(([state, words, tone]) => ({
    count: states.filter((each) => each === state).length,
    state,
    words,
    tone,
  })).filter((entry) => entry.count > 0);
  const only = counted.length === 1 ? counted[0] : undefined;
  if (only) return [{ text: `${total} more, ${allOf(total, only.state)}`, tone: only.tone }];
  const parts = counted.map(({ count, words, tone }) => ({ text: words(count), tone }));
  return [{ text: `${total} more: `, tone: "plain" }, ...joinParts(parts)];
}

function allOf(total: number, state: WatchState): string {
  if (total === 1) return state === "error" ? "with an error" : ALL_WORDS[state];
  return `${total === 2 ? "both" : "all"} ${ALL_WORDS[state]}`;
}

function joinParts(parts: Line[]): Line[] {
  return parts.flatMap((part, index) =>
    index === 0 ? [part] : [{ text: ", ", tone: "plain" as const }, part],
  );
}

/** The More options row's summary of what is behind it. */
export function moreSummary(
  draft: Pick<WatchDraft, "priority" | "once" | "refresh" | "refreshMinutes">,
): string {
  const parts = [
    `${priorityLabel(draft.priority)} priority`,
    draft.once ? "blips once" : "blips every time",
  ];
  const reload = refreshing(draft);
  if (reload !== null) parts.push(`reloads every ${minutesPhrase(reload)}`);
  return parts.join(", ");
}

export function everyTimeLine(once: boolean): string {
  return once
    ? "Off. Blips once, then the watch turns off."
    : "On. Blips every time the element changes.";
}

export function freshLine(refresh: boolean): string {
  return refresh
    ? "On. Reloads the tab while it is in the background."
    : "Off. Blipr never reloads the tab.";
}

export function savedToast(selector: string): string {
  return `Watching ${selector}. Keep this tab open.`;
}

export function hostOfServer(server: string): string {
  try {
    return new URL(server).host;
  } catch {
    return server;
  }
}

export type Pill = { text: string; ok: boolean };

/** No pill until Blipr has asked the server at least once. */
export function connectionPill(check: ConnectionCheck | null, server: string): Pill | null {
  if (!check || check.server !== server) return null;
  return check.ok ? { text: "Connected", ok: true } : { text: "Not connected", ok: false };
}

export type Callout = { strong: string; rest: string };

export function offlineCallout(check: ConnectionCheck): Callout {
  const last = check.lastOkAt === undefined ? "" : ` Last answer at ${clock(check.lastOkAt)}.`;
  return {
    strong: `Blipr can't reach ${hostOfServer(check.server)}.`,
    rest: `Watches keep watching, but blips can't be sent until the connection is back.${last}`,
  };
}

/** `justNow` is for the result of a check the person just asked for. */
export function checkResultLine(check: ConnectionCheck, justNow = false): string {
  const host = hostOfServer(check.server);
  const when = justNow ? "just now" : `at ${clock(check.at)}`;
  return check.ok ? `${host} answered ${when}` : `${host} didn't answer ${when}`;
}

export function checkingLine(server: string): string {
  return `Checking ${hostOfServer(server)}…`;
}

/** The Watches tab's warning, when any watch has an error. */
export function errorCallout(watches: Watch[]): Callout | null {
  const failing = watches.filter((watch) => watch.enabled && watch.lastError);
  if (failing.length === 0) return null;
  const one = failing.length === 1;
  const unreachable = failing.every((watch) => /could not reach/i.test(watch.lastError ?? ""));
  const who = one ? "One watch" : `${failing.length} watches`;
  const rows = one ? "Its row says" : "Their rows say";
  if (unreachable) {
    return {
      strong: `${who} couldn't reach the server.`,
      rest: `${rows} when. Check your network, or the server in Settings.`,
    };
  }
  return {
    strong: `${who} ${one ? "needs" : "need"} attention.`,
    rest: `${rows} what went wrong.`,
  };
}

/** A site's line under Site access. */
export function siteAccessLine(open: boolean, enabled: number): Line {
  if (open) {
    const running =
      enabled === 0 ? "No watches on." : `${plural(enabled, "watch", "watches")} running.`;
    return { text: `Open in a tab. ${running}`, tone: "plain" };
  }
  const paused =
    enabled === 0 ? "No watches on." : `${plural(enabled, "watch", "watches")} paused.`;
  return { text: `Not open in any tab. ${paused}`, tone: enabled === 0 ? "plain" : "warn" };
}
