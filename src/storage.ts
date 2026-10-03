// Everything the extension remembers, on this machine only. `local` holds the
// watches, the defaults a new one starts from, the last connection check and a
// few popup preferences; `session` holds what a picker run leaves behind for a
// popup that has already closed. Never `sync`: what you set up stays on the
// device you set it up on.
import browser from "webextension-polyfill";

import type { SelectorPick } from "./core/selector.js";
import type { Watch, WatchDraft } from "./core/watch.js";
import { clampCooldown, migrateWatch } from "./core/watch.js";

export const WATCHES = "watches";
export const DEFAULTS = "defaults";
export const CONNECTION = "connection";
const PREFS = "prefs";

export type WatchDefaults = Partial<
  Pick<Watch, "topic" | "server" | "priority" | "cooldownSeconds">
>;

/** The last time Blipr asked the server whether it is there. */
export type ConnectionCheck = { server: string; ok: boolean; at: number; lastOkAt?: number };

export type Prefs = { othersOpen?: boolean };

/** A patch may clear `lastError`, which a plain `Partial<Watch>` cannot say. */
export type WatchPatch = Partial<Omit<Watch, "lastError" | "lastErrorAt">> & {
  lastError?: string | undefined;
  lastErrorAt?: number | undefined;
};

export async function getWatches(): Promise<Watch[]> {
  const stored = await browser.storage.local.get(WATCHES);
  const value = stored[WATCHES];
  return Array.isArray(value) ? (value as Watch[]).map(migrateWatch) : [];
}

export async function getWatch(id: string): Promise<Watch | null> {
  return (await getWatches()).find((watch) => watch.id === id) ?? null;
}

export async function putWatch(watch: Watch): Promise<void> {
  const watches = await getWatches();
  const index = watches.findIndex((candidate) => candidate.id === watch.id);
  if (index === -1) watches.push(watch);
  else watches[index] = watch;
  await setWatches(watches);
}

export async function patchWatch(id: string, patch: WatchPatch): Promise<Watch | null> {
  const watches = await getWatches();
  const index = watches.findIndex((watch) => watch.id === id);
  const current = watches[index];
  if (!current) return null;
  // The spread widens `lastError` to include undefined, which is the point of a patch.
  const next = { ...current, ...patch } as Watch;
  watches[index] = next;
  await setWatches(watches);
  return next;
}

/** Many watches in one write, so a site's watches switch off together. */
export async function patchWatches(ids: string[], patch: WatchPatch): Promise<void> {
  const watches = await getWatches();
  await setWatches(
    watches.map((watch) => (ids.includes(watch.id) ? ({ ...watch, ...patch } as Watch) : watch)),
  );
}

export async function deleteWatch(id: string): Promise<void> {
  await setWatches((await getWatches()).filter((watch) => watch.id !== id));
}

async function setWatches(watches: Watch[]): Promise<void> {
  await browser.storage.local.set({ [WATCHES]: watches });
}

/** What a new watch starts from, so the usual case is pick a selector and save. */
export async function getDefaults(): Promise<WatchDefaults> {
  const stored = await browser.storage.local.get(DEFAULTS);
  const value: unknown = stored[DEFAULTS];
  if (typeof value !== "object" || value === null) return {};
  const defaults = value as WatchDefaults;
  return defaults.cooldownSeconds === undefined
    ? defaults
    : { ...defaults, cooldownSeconds: clampCooldown(defaults.cooldownSeconds) };
}

export async function setDefaults(patch: WatchDefaults): Promise<WatchDefaults> {
  const next = { ...(await getDefaults()), ...patch };
  await browser.storage.local.set({ [DEFAULTS]: next });
  return next;
}

/** Only the first watch's topic becomes a default, and only when the user says so. */
export async function rememberTopic(draft: Pick<WatchDraft, "topic">): Promise<void> {
  await setDefaults({ topic: draft.topic.trim() });
}

export async function getConnection(): Promise<ConnectionCheck | null> {
  const stored = await browser.storage.local.get(CONNECTION);
  const value: unknown = stored[CONNECTION];
  return typeof value === "object" && value !== null ? (value as ConnectionCheck) : null;
}

export async function setConnection(check: ConnectionCheck | null): Promise<void> {
  if (check) await browser.storage.local.set({ [CONNECTION]: check });
  else await browser.storage.local.remove(CONNECTION);
}

export async function getPrefs(): Promise<Prefs> {
  const stored = await browser.storage.local.get(PREFS);
  const value: unknown = stored[PREFS];
  return typeof value === "object" && value !== null ? value : {};
}

export async function setPrefs(patch: Prefs): Promise<void> {
  await browser.storage.local.set({ [PREFS]: { ...(await getPrefs()), ...patch } });
}

export async function stashPick(tabId: number, pick: SelectorPick): Promise<void> {
  await browser.storage.session.set({ [pickKey(tabId)]: pick });
}

export function takePick(tabId: number): Promise<SelectorPick | null> {
  return take<SelectorPick>(pickKey(tabId));
}

/** Picking closes the popup mid-edit, so the half-filled form waits here too. */
export async function stashDraft(tabId: number, draft: WatchDraft): Promise<void> {
  await browser.storage.session.set({ [draftKey(tabId)]: draft });
}

export function takeDraft(tabId: number): Promise<WatchDraft | null> {
  return take<WatchDraft>(draftKey(tabId));
}

export async function forgetTab(tabId: number): Promise<void> {
  await browser.storage.session.remove([pickKey(tabId), draftKey(tabId)]);
}

async function take<T>(key: string): Promise<T | null> {
  const stored = await browser.storage.session.get(key);
  const value = stored[key];
  if (value === undefined) return null;
  await browser.storage.session.remove(key);
  return value as T;
}

function pickKey(tabId: number): string {
  return `pick:${tabId}`;
}

function draftKey(tabId: number): string {
  return `draft:${tabId}`;
}
