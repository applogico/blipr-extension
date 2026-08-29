// The watch form, in and out. The mapping between what the controls hold and
// what a `WatchDraft` is lives in `draftFrom`/`valuesFrom`, away from the DOM.
import type { Condition, Watch, WatchDraft } from "../core/watch.js";
import {
  DEFAULT_COOLDOWN_SECONDS,
  DEFAULT_PRIORITY,
  DEFAULT_SERVER,
  cooldownSecondsOf,
} from "../core/watch.js";
import type { WatchDefaults } from "../storage.js";

const FIELDS = [
  "urlPattern",
  "selector",
  "condition",
  "topic",
  "server",
  "token",
  "title",
  "message",
  "priority",
  "repeat",
  "cooldownSeconds",
  "refresh",
  "refreshMinutes",
] as const;

type Field = (typeof FIELDS)[number];
export type FormValues = Record<Field, string>;

export function draftFrom(values: FormValues, id?: string): WatchDraft {
  const token = values.token.trim();
  const title = values.title.trim();
  const message = values.message.trim();
  const priority = Number(values.priority.trim());
  return {
    urlPattern: values.urlPattern.trim(),
    selector: values.selector.trim(),
    condition: condition(values.condition),
    topic: values.topic.trim(),
    server: values.server.trim() || DEFAULT_SERVER,
    priority: Number.isInteger(priority) && priority > 0 ? priority : DEFAULT_PRIORITY,
    once: values.repeat === "once",
    cooldownSeconds: cooldownFrom(values.cooldownSeconds),
    ...refreshFrom(values),
    ...(token ? { token } : {}),
    ...(title ? { title } : {}),
    ...(message ? { message } : {}),
    ...(id ? { id } : {}),
  };
}

/** A cleared box is a deliberate zero: no cooldown, blip on every transition. */
function cooldownFrom(value: string): number {
  const seconds = Number(value.trim());
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : DEFAULT_COOLDOWN_SECONDS;
}

/** A blank interval is no interval at all, rather than a zero. */
function refreshFrom(values: FormValues): Pick<WatchDraft, "refresh" | "refreshMinutes"> {
  const minutes = values.refreshMinutes.trim();
  return {
    ...(values.refresh === "on" ? { refresh: true } : {}),
    ...(minutes ? { refreshMinutes: Number(minutes) } : {}),
  };
}

export function valuesFrom(draft: WatchDraft): FormValues {
  return {
    urlPattern: draft.urlPattern,
    selector: draft.selector,
    condition: draft.condition,
    topic: draft.topic,
    server: draft.server,
    token: draft.token ?? "",
    title: draft.title ?? "",
    message: draft.message ?? "",
    priority: String(draft.priority),
    repeat: draft.once ? "once" : "every",
    cooldownSeconds: String(cooldownSecondsOf(draft)),
    refresh: draft.refresh ? "on" : "off",
    refreshMinutes: draft.refreshMinutes === undefined ? "" : String(draft.refreshMinutes),
  };
}

/** A new watch inherits the last one's settings, so the usual case is pick and save. */
export function blankDraft(defaults: WatchDefaults, urlPattern: string): WatchDraft {
  return {
    urlPattern,
    selector: "",
    condition: "appears",
    topic: defaults.topic ?? "",
    server: defaults.server ?? DEFAULT_SERVER,
    priority: defaults.priority ?? DEFAULT_PRIORITY,
    once: true,
    cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
    ...(defaults.token ? { token: defaults.token } : {}),
  };
}

export function toDraft(watch: Watch): WatchDraft {
  return {
    id: watch.id,
    urlPattern: watch.urlPattern,
    selector: watch.selector,
    condition: watch.condition,
    topic: watch.topic,
    server: watch.server,
    priority: watch.priority,
    once: watch.once,
    cooldownSeconds: cooldownSecondsOf(watch),
    ...(watch.refresh ? { refresh: true } : {}),
    ...(watch.refreshMinutes === undefined ? {} : { refreshMinutes: watch.refreshMinutes }),
    ...(watch.token ? { token: watch.token } : {}),
    ...(watch.title ? { title: watch.title } : {}),
    ...(watch.message ? { message: watch.message } : {}),
  };
}

export function readForm(form: HTMLFormElement): FormValues {
  const values = {} as FormValues;
  for (const name of FIELDS) values[name] = field(form, name).value;
  return values;
}

export function fillForm(form: HTMLFormElement, draft: WatchDraft): void {
  const values = valuesFrom(draft);
  for (const name of FIELDS) field(form, name).value = values[name];
}

function field(form: HTMLFormElement, name: Field): HTMLInputElement | HTMLSelectElement {
  const node = form.elements.namedItem(name);
  if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement) return node;
  throw new Error(`The form has no ${name} field.`);
}

function condition(value: string): Condition {
  return value === "gone" ? "gone" : "appears";
}
