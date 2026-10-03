// The watch a form starts from and what it hands back. The editor keeps the
// draft in memory; these are the pure edges of that.
import type { Watch, WatchDraft } from "../core/watch.js";
import {
  DEFAULT_PRIORITY,
  DEFAULT_SERVER,
  MAX_REFRESH_MINUTES,
  MIN_REFRESH_MINUTES,
  clampCooldown,
  cooldownSecondsOf,
} from "../core/watch.js";
import type { WatchDefaults } from "../storage.js";

/** A new watch starts from the defaults in Settings, so the usual case is pick and save. */
export function blankDraft(defaults: WatchDefaults, urlPattern: string): WatchDraft {
  return {
    urlPattern,
    selector: "",
    condition: "appears",
    topic: defaults.topic ?? "",
    server: defaults.server ?? DEFAULT_SERVER,
    priority: defaults.priority ?? DEFAULT_PRIORITY,
    once: true,
    cooldownSeconds: clampCooldown(defaults.cooldownSeconds),
  };
}

export function toDraft(watch: Watch): WatchDraft {
  return {
    id: watch.id,
    urlPattern: watch.urlPattern,
    selector: watch.selector,
    condition: watch.condition,
    ...(watch.containsText ? { containsText: watch.containsText } : {}),
    topic: watch.topic,
    server: watch.server,
    priority: watch.priority,
    once: watch.once,
    cooldownSeconds: cooldownSecondsOf(watch),
    ...(watch.refresh ? { refresh: true } : {}),
    ...(watch.refreshMinutes === undefined ? {} : { refreshMinutes: watch.refreshMinutes }),
    ...(watch.title ? { title: watch.title } : {}),
    ...(watch.message ? { message: watch.message } : {}),
  };
}

/** Trimmed, with every empty optional field left out rather than saved blank. */
export function cleanDraft(draft: WatchDraft): WatchDraft {
  const { containsText, title, message, refresh, ...rest } = draft;
  return {
    ...rest,
    urlPattern: rest.urlPattern.trim(),
    selector: rest.selector.trim(),
    topic: rest.topic.trim(),
    server: rest.server.trim() || DEFAULT_SERVER,
    ...(refresh ? { refresh: true } : {}),
    ...kept("containsText", containsText),
    ...kept("title", title),
    ...kept("message", message),
  };
}

function kept<K extends string>(name: K, value: string | undefined): Partial<Record<K, string>> {
  const trimmed = value?.trim() ?? "";
  return trimmed ? ({ [name]: trimmed } as Record<K, string>) : {};
}

/** Switching the reload on starts at the fastest interval unless one was set before. */
export function withRefresh(draft: WatchDraft, on: boolean): WatchDraft {
  if (!on) {
    const rest = { ...draft };
    delete rest.refresh;
    return rest;
  }
  return { ...draft, refresh: true, refreshMinutes: draft.refreshMinutes ?? MIN_REFRESH_MINUTES };
}

export const REFRESH_BOUNDS = { min: MIN_REFRESH_MINUTES, max: MAX_REFRESH_MINUTES, step: 1 };

/** The topic becomes the default only for a first watch, and only with the box ticked. */
export function shouldRememberTopic(
  defaults: WatchDefaults,
  useAsDefault: boolean,
  topic: string,
): boolean {
  return !defaults.topic && useAsDefault && topic.trim() !== "";
}
