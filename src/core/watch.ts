export type Condition = "appears" | "gone";

export type Watch = {
  id: string;
  /** Matched against the whole URL; `*` is the only wildcard. */
  urlPattern: string;
  selector: string;
  condition: Condition;
  topic: string;
  server: string;
  token?: string;
  priority: number;
  /** Disable itself after firing once. */
  once: boolean;
  enabled: boolean;
  /** Reload the watched tab on a timer, so a hidden tab keeps producing a fresh page. */
  refresh?: boolean;
  /** How often to reload. Kept when refreshing is switched off, so it can be switched back on. */
  refreshMinutes?: number;
  lastFiredAt?: number;
  lastRefreshedAt?: number;
  lastError?: string;
};

export type WatchDraft = Omit<
  Watch,
  "id" | "enabled" | "lastFiredAt" | "lastRefreshedAt" | "lastError"
> & {
  id?: string;
};

export const DEFAULT_SERVER = "https://blipr.dev";
export const DEFAULT_PRIORITY = 3;
/** A browser alarm will not tick faster than once a minute, so minutes are the unit. */
export const MIN_REFRESH_MINUTES = 1;
export const MAX_REFRESH_MINUTES = 1440;

/** Every problem with `draft`, so the form can show them all at once. */
export function validate(draft: WatchDraft): string[] {
  const problems: string[] = [];
  if (!draft.urlPattern.trim()) problems.push("Add a URL pattern.");
  if (!draft.selector.trim()) problems.push("Add a CSS selector.");
  if (!draft.topic.trim()) problems.push("Add a topic.");
  if (!isHttpUrl(draft.server)) problems.push("The server must be an http(s) URL.");
  if (!Number.isInteger(draft.priority) || draft.priority < 1 || draft.priority > 5) {
    problems.push("Priority must be a whole number from 1 to 5.");
  }
  if (draft.refresh && draft.refreshMinutes === undefined) {
    problems.push("Say how often to refresh the page, in minutes.");
  }
  if (draft.refreshMinutes !== undefined && !isInterval(draft.refreshMinutes)) {
    problems.push(
      `Refresh must be a whole number of minutes from ${MIN_REFRESH_MINUTES} to ${MAX_REFRESH_MINUTES}.`,
    );
  }
  return problems;
}

function isInterval(minutes: number): boolean {
  return (
    Number.isInteger(minutes) && minutes >= MIN_REFRESH_MINUTES && minutes <= MAX_REFRESH_MINUTES
  );
}

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
