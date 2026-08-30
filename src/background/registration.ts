// Host access is optional, so the content script is registered for the origins
// the user has actually granted, and unregistered when the last watch for an
// origin goes away.
import browser from "webextension-polyfill";

import { originPattern } from "../core/origins.js";
import { getWatches } from "../storage.js";

const SCRIPT_ID = "blipr-watch";
const CONTENT_JS = "content/index.js";

let queue: Promise<void> = Promise.resolve();

/** Serialized: two syncs at once would race between register and update. */
export function syncContentScripts(): Promise<void> {
  queue = queue.then(guarded, guarded);
  return queue;
}

/** One engine refusing a pattern must not poison the queue, or fail a save. */
async function guarded(): Promise<void> {
  try {
    await sync();
  } catch (error) {
    console.warn("Blipr could not update where its page watcher runs.", error);
  }
}

/** A freshly registered script only runs on the next load, so open tabs get it now. */
export async function injectInto(origin: string): Promise<void> {
  const tabs = await browser.tabs.query({ url: origin }).catch(() => []);
  const started = tabs.flatMap((tab) => (tab.id === undefined ? [] : [tryInject(tab.id)]));
  await Promise.all(started);
}

async function sync(): Promise<void> {
  const matches = await grantedOrigins();
  const [existing] = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (matches.length === 0) {
    if (existing) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return;
  }
  if (existing && same(existing.matches ?? [], matches)) return;
  const script = { id: SCRIPT_ID, matches, js: [CONTENT_JS], runAt: "document_idle" as const };
  if (existing) await browser.scripting.updateContentScripts([script]);
  else await browser.scripting.registerContentScripts([script]);
}

function same(before: string[], after: string[]): boolean {
  return before.length === after.length && before.every((origin) => after.includes(origin));
}

/** Registering an origin the user declined throws, so only granted ones are asked for. */
async function grantedOrigins(): Promise<string[]> {
  const watches = await getWatches();
  const wanted = new Set(
    watches.filter((watch) => watch.enabled).flatMap((watch) => pattern(watch.urlPattern)),
  );
  const held = await Promise.all(
    [...wanted].map((origin) => browser.permissions.contains({ origins: [origin] })),
  );
  return [...wanted].filter((_, index) => held[index]);
}

function pattern(urlPattern: string): string[] {
  const origin = originPattern(urlPattern);
  return origin ? [origin] : [];
}

export async function ensureContentScript(tabId: number): Promise<void> {
  await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_JS] });
}

/** A tab that navigated away or cannot be scripted is not a reason to fail a save. */
function tryInject(tabId: number): Promise<void> {
  return ensureContentScript(tabId).catch(() => undefined);
}
