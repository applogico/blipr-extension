// A watch as plain JSON to paste to someone: what it watches, never where it sends or how it is doing.
import { originPattern } from "./origins.js";
import type { Condition, Watch, WatchDraft } from "./watch.js";
import {
  MAX_COOLDOWN_SECONDS,
  MAX_REFRESH_MINUTES,
  MIN_COOLDOWN_SECONDS,
  MIN_REFRESH_MINUTES,
  cooldownSecondsOf,
} from "./watch.js";

export const MAX_SHARE_CHARS = 20_000;
export const SHARE_LIMITS = {
  urlPattern: 2048,
  selector: 2000,
  containsText: 1000,
  title: 250,
  message: 2000,
} as const;

export const NOT_A_SHARE = "This isn't a shared Blipr watch. Ask for it again, copied with Share.";
export const TOO_LONG = "This is too long to be a shared watch.";

/** The fields a share is built from: an allowlist, so a new Watch field never leaks by default. */
export type Shareable = Pick<
  Watch,
  | "urlPattern"
  | "selector"
  | "containsText"
  | "condition"
  | "priority"
  | "once"
  | "cooldownSeconds"
  | "refresh"
  | "refreshMinutes"
  | "title"
  | "message"
>;

/** What a pasted share yields. Absent fields fall back to the importer's own defaults. */
export type SharedWatch = {
  urlPattern: string;
  selector: string;
  condition: Condition;
  containsText?: string;
  priority?: number;
  once?: boolean;
  cooldownSeconds?: number;
  /** Present only when the shared watch keeps its tab fresh. */
  refreshMinutes?: number;
  title?: string;
  message?: string;
};

export type ParsedShare = { shared: SharedWatch } | { error: string };

export function shareWatch(watch: Shareable): string {
  const json = {
    urlPattern: watch.urlPattern,
    selector: watch.selector,
    ...(watch.containsText ? { textContains: watch.containsText } : {}),
    blipWhen: watch.condition,
    priority: watch.priority,
    blipEveryTime: !watch.once,
    cooldownSeconds: cooldownSecondsOf(watch),
    ...(watch.refresh ? { reloadEveryMinutes: watch.refreshMinutes ?? MIN_REFRESH_MINUTES } : {}),
    ...(watch.title ? { title: watch.title } : {}),
    ...(watch.message ? { message: watch.message } : {}),
  };
  return JSON.stringify(json, null, 2);
}

export function parseShare(input: string): ParsedShare {
  if (input.length > MAX_SHARE_CHARS) return { error: TOO_LONG };
  const value = parseJson(unwrap(input));
  if (!isPlainObject(value) || !looksLikeWatch(value)) return { error: NOT_A_SHARE };
  return readFields(value);
}

/** A new, unsaved draft: the shared watch, sent to the importer's own server and topic. */
export function importedDraft(base: WatchDraft, shared: SharedWatch): WatchDraft {
  const cooldownSeconds = shared.cooldownSeconds ?? base.cooldownSeconds;
  const { refreshMinutes } = shared;
  return {
    urlPattern: shared.urlPattern,
    selector: shared.selector,
    condition: shared.condition,
    topic: base.topic,
    server: base.server,
    priority: shared.priority ?? base.priority,
    once: shared.once ?? base.once,
    ...(cooldownSeconds === undefined ? {} : { cooldownSeconds }),
    ...(refreshMinutes === undefined ? {} : { refresh: true, refreshMinutes }),
    ...wording(shared),
  };
}

function wording(shared: SharedWatch): Pick<WatchDraft, "containsText" | "title" | "message"> {
  const { containsText, title, message } = shared;
  return {
    ...(containsText === undefined ? {} : { containsText }),
    ...(title === undefined ? {} : { title }),
    ...(message === undefined ? {} : { message }),
  };
}

/** Slack and chat apps wrap pasted code in fences or backticks; either is accepted. */
function unwrap(input: string): string {
  const trimmed = input.trim();
  const fenced = /^```[\w-]*[ \t]*\r?\n?([\s\S]*?)\s*```$/.exec(trimmed);
  if (fenced) return (fenced[1] ?? "").trim();
  const inline = /^`([^`]*)`$/.exec(trimmed);
  return inline ? (inline[1] ?? "").trim() : trimmed;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const BAD = Symbol("bad");
type Reader = (value: unknown) => unknown;
type Field = { json: string; key: keyof SharedWatch; what: string; read: Reader; needed?: true };

/** Every field a share may carry; anything else in the JSON is dropped unread. */
const FIELDS: Field[] = [
  { json: "urlPattern", key: "urlPattern", what: "URL pattern", read: urlPattern, needed: true },
  {
    json: "selector",
    key: "selector",
    what: "element",
    read: text(SHARE_LIMITS.selector),
    needed: true,
  },
  {
    json: "textContains",
    key: "containsText",
    what: "text to match",
    read: optionalText(SHARE_LIMITS.containsText),
  },
  {
    json: "blipWhen",
    key: "condition",
    what: "condition",
    read: oneOf(["appears", "gone"]),
    needed: true,
  },
  { json: "priority", key: "priority", what: "priority", read: whole(1, 5) },
  { json: "blipEveryTime", key: "once", what: "every time setting", read: invertedFlag },
  {
    json: "cooldownSeconds",
    key: "cooldownSeconds",
    what: "cooldown",
    read: whole(MIN_COOLDOWN_SECONDS, MAX_COOLDOWN_SECONDS),
  },
  {
    json: "reloadEveryMinutes",
    key: "refreshMinutes",
    what: "reload time",
    read: whole(MIN_REFRESH_MINUTES, MAX_REFRESH_MINUTES),
  },
  { json: "title", key: "title", what: "title", read: optionalText(SHARE_LIMITS.title) },
  { json: "message", key: "message", what: "message", read: optionalText(SHARE_LIMITS.message) },
];

/** JSON with none of a watch's required fields is something else pasted by mistake. */
function looksLikeWatch(value: Record<string, unknown>): boolean {
  return FIELDS.some((field) => field.needed && Object.hasOwn(value, field.json));
}

function readFields(value: Record<string, unknown>): ParsedShare {
  const shared: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const present = Object.hasOwn(value, field.json) && value[field.json] !== undefined;
    if (!present && field.needed) return { error: badField(field.what) };
    if (!present) continue;
    const read = field.read(value[field.json]);
    if (read === BAD) return { error: badField(field.what) };
    if (read !== undefined) shared[field.key] = read;
  }
  return { shared: shared as SharedWatch };
}

export function badField(what: string): string {
  return `The ${what} in this shared watch isn't valid.`;
}

/** Control characters have no place in a one-line field, so they mark the input as bad. */
function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function text(max: number): Reader {
  return (value) => {
    if (typeof value !== "string") return BAD;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.length > max || hasControl(trimmed)) return BAD;
    return trimmed;
  };
}

/** An empty optional field is left out, as the editor would save it. */
function optionalText(max: number): Reader {
  const read = text(max);
  return (value) => (typeof value === "string" && value.trim() === "" ? undefined : read(value));
}

function urlPattern(value: unknown): unknown {
  const read = text(SHARE_LIMITS.urlPattern)(value);
  return typeof read === "string" && originPattern(read) !== null ? read : BAD;
}

function oneOf(values: string[]): Reader {
  return (value) => (typeof value === "string" && values.includes(value) ? value : BAD);
}

function whole(least: number, most: number): Reader {
  return (value) =>
    typeof value === "number" && Number.isInteger(value) && value >= least && value <= most
      ? value
      : BAD;
}

function invertedFlag(value: unknown): unknown {
  return typeof value === "boolean" ? !value : BAD;
}
