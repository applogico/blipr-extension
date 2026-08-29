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
  /** Wording of its own, in place of Blipr's. Both may use `{selector}`, `{matches}` and `{url}`. */
  title?: string;
  message?: string;
  /** Reload the watched tab on a timer, so a hidden tab keeps producing a fresh page. */
  refresh?: boolean;
  /** How often to reload. Kept when refreshing is switched off, so it can be switched back on. */
  refreshMinutes?: number;
  /** Shortest gap between two blips. Zero sends every transition; absent means the default. */
  cooldownSeconds?: number;
  /**
   * When this watch started watching. A page that was already open then starts
   * armed, so a watch never blips for what was on screen before it existed.
   */
  watchingSince?: number;
  lastFiredAt?: number;
  lastSuppressedAt?: number;
  lastRefreshedAt?: number;
  lastError?: string;
};

export type WatchDraft = Omit<
  Watch,
  | "id"
  | "enabled"
  | "watchingSince"
  | "lastFiredAt"
  | "lastSuppressedAt"
  | "lastRefreshedAt"
  | "lastError"
> & {
  id?: string;
};

export const DEFAULT_SERVER = "https://blipr.dev";
export const DEFAULT_PRIORITY = 3;
/** A browser alarm will not tick faster than once a minute, so minutes are the unit. */
export const MIN_REFRESH_MINUTES = 1;
export const MAX_REFRESH_MINUTES = 1440;
/** Only a transition fires, so this guards a flapping DOM and nothing else. */
export const DEFAULT_COOLDOWN_SECONDS = 5;
export const MIN_COOLDOWN_SECONDS = 0;
export const MAX_COOLDOWN_SECONDS = 3600;

export function cooldownSecondsOf(watch: Pick<Watch, "cooldownSeconds">): number {
  return watch.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
}

type Rule = { passes: (draft: WatchDraft) => boolean; problem: string };

/** Independent checks, in the order the form should complain about them. */
const RULES: Rule[] = [
  { passes: (draft) => draft.urlPattern.trim() !== "", problem: "Add a URL pattern." },
  { passes: (draft) => draft.selector.trim() !== "", problem: "Add a CSS selector." },
  { passes: (draft) => draft.topic.trim() !== "", problem: "Add a topic." },
  { passes: (draft) => isHttpUrl(draft.server), problem: "The server must be an http(s) URL." },
  {
    passes: (draft) => isWhole(draft.priority, 1, 5),
    problem: "Priority must be a whole number from 1 to 5.",
  },
  {
    passes: (draft) => !draft.refresh || draft.refreshMinutes !== undefined,
    problem: "Say how often to refresh the page, in minutes.",
  },
  {
    passes: (draft) =>
      draft.refreshMinutes === undefined ||
      isWhole(draft.refreshMinutes, MIN_REFRESH_MINUTES, MAX_REFRESH_MINUTES),
    problem: `Refresh must be a whole number of minutes from ${MIN_REFRESH_MINUTES} to ${MAX_REFRESH_MINUTES}.`,
  },
  {
    passes: (draft) =>
      draft.cooldownSeconds === undefined ||
      isWhole(draft.cooldownSeconds, MIN_COOLDOWN_SECONDS, MAX_COOLDOWN_SECONDS),
    problem: `Cooldown must be a whole number of seconds from ${MIN_COOLDOWN_SECONDS} to ${MAX_COOLDOWN_SECONDS}.`,
  },
];

/** Every problem with `draft`, so the form can show them all at once. */
export function validate(draft: WatchDraft): string[] {
  return RULES.filter((rule) => !rule.passes(draft)).map((rule) => rule.problem);
}

function isWhole(value: number, least: number, most: number): boolean {
  return Number.isInteger(value) && value >= least && value <= most;
}

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
