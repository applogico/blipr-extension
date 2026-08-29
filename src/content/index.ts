// The page half: watch the DOM for the selectors that apply to this URL and
// report the edges. It is handed only `{id, selector, condition}` — a token
// never reaches a content script.
import browser from "webextension-polyfill";

import type { EdgeState } from "../core/edges.js";
import { GRACE_MS, createdState, initialState, step } from "../core/edges.js";
import { tryCount } from "../core/selector.js";
import type { Watch } from "../core/watch.js";
import { onMessage, send } from "../messages.js";
import { arm } from "./picker.js";

type LiveWatch = Pick<Watch, "id" | "selector" | "condition" | "watchingSince">;

const POLL_MS = 5_000;
const DEBOUNCE_MS = 250;

const states = new Map<string, EdgeState>();
const broken = new Set<string>();
/** What the background last said about each watch, to spot the ones that changed. */
let described = new Map<string, string>();

let startedAt = Date.now();
/** When the page itself was opened, which can be long before this script was injected into it. */
let openedAt = performance.timeOrigin || startedAt;
let watches: LiveWatch[] = [];
let signature = "";
let url = location.href;
let observer: MutationObserver | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
let settle: ReturnType<typeof setTimeout> | null = null;

if (!alreadyRunning()) start();

/** A registered script and an on-demand injection can both land on one page. */
function alreadyRunning(): boolean {
  const scope = globalThis as unknown as Record<string, unknown>;
  if (scope.__bliprContent === true) return true;
  scope.__bliprContent = true;
  return false;
}

function start(): void {
  onMessage({
    armPicker: ({ tabId }) => {
      arm((pick) => quietly(send({ kind: "pickResult", tabId, pick })));
    },
    countMatches: ({ selector }) => tryCount(document, selector),
  });
  browser.storage.onChanged.addListener(() => void refresh());
  void refresh();
}

async function refresh(): Promise<void> {
  const next = await send({ kind: "watchesForUrl", url: location.href }).catch(() => []);
  const nextSignature = JSON.stringify(next);
  if (nextSignature === signature) return;
  signature = nextSignature;
  watches = next;
  reconcile(next);
  if (watches.length > 0) observe();
  else stop();
  check();
}

/** A watch that changed starts over; the rest keep what this page has already seen. */
function reconcile(next: LiveWatch[]): void {
  const fresh = new Map(next.map((watch) => [watch.id, JSON.stringify(watch)]));
  for (const [id, description] of described) {
    if (fresh.get(id) === description) continue;
    states.delete(id);
    broken.delete(id);
  }
  described = fresh;
}

function check(): void {
  // A single-page app can swap the whole route without a load, so a changed URL
  // starts the page over: new watches, fresh edges, and a fresh grace period.
  if (location.href !== url) {
    url = location.href;
    startedAt = Date.now();
    openedAt = startedAt;
    signature = "";
    states.clear();
    broken.clear();
    void refresh();
    return;
  }
  for (const watch of watches) {
    if (!broken.has(watch.id)) inspect(watch);
  }
}

function inspect(watch: LiveWatch): void {
  const counted = tryCount(document, watch.selector);
  if ("error" in counted) {
    // A selector that will not parse never will, so it is reported once and dropped.
    broken.add(watch.id);
    quietly(send({ kind: "watchError", watchId: watch.id, error: counted.error }));
    return;
  }
  const before = states.get(watch.id) ?? seedFor(watch, counted.matches);
  const { state, fire } = step(watch.condition, before, {
    matches: counted.matches,
    startedAt,
    now: Date.now(),
  });
  states.set(watch.id, state);
  if (fire) {
    quietly(send({ kind: "conditionMet", watchId: watch.id, matches: counted.matches, url }));
  }
}

/**
 * A watch saved while this page was already open must not blip for what was on
 * screen then. Measured against the page, not against this script: saving the
 * first watch for a site is what injects the script in the first place.
 */
function seedFor(watch: LiveWatch, matches: number): EdgeState {
  const since = watch.watchingSince ?? 0;
  return since > openedAt ? createdState(watch.condition, matches) : initialState();
}

function observe(): void {
  observer ??= new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  // The interval covers pages that render late; the one-shot covers the grace period
  // for a "gone" watch whose selector never matched here at all.
  poll ??= setInterval(check, POLL_MS);
  settle ??= setTimeout(check, GRACE_MS);
}

function stop(): void {
  observer?.disconnect();
  if (poll !== null) clearInterval(poll);
  poll = null;
}

function schedule(): void {
  debounce ??= setTimeout(() => {
    debounce = null;
    check();
  }, DEBOUNCE_MS);
}

/** The background may be asleep or the page unloading; neither is worth an error. */
function quietly(promise: Promise<unknown>): void {
  promise.catch(() => undefined);
}
