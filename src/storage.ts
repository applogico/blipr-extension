// Everything the extension remembers, on this machine only. `local` holds the
// watches and the defaults a new one starts from; `session` holds what a picker
// run leaves behind for a popup that has already closed. Never `sync`: a token
// stays on the device it was typed into.
import browser from "webextension-polyfill";

import type { SelectorPick } from "./core/selector.js";
import type { Watch, WatchDraft } from "./core/watch.js";

export const WATCHES = "watches";
const DEFAULTS = "defaults";

export type WatchDefaults = Partial<Pick<Watch, "topic" | "server" | "token" | "priority">>;

/** A patch may clear `lastError`, which a plain `Partial<Watch>` cannot say. */
export type WatchPatch = Partial<Omit<Watch, "lastError">> & { lastError?: string | undefined };

export async function getWatches(): Promise<Watch[]> {
  const stored = await browser.storage.local.get(WATCHES);
  const value = stored[WATCHES];
  return Array.isArray(value) ? (value as Watch[]) : [];
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

export async function deleteWatch(id: string): Promise<void> {
  await setWatches((await getWatches()).filter((watch) => watch.id !== id));
}

async function setWatches(watches: Watch[]): Promise<void> {
  await browser.storage.local.set({ [WATCHES]: watches });
}

/** What a new watch starts from, so the usual case is pick a selector and save. */
export async function getDefaults(): Promise<WatchDefaults> {
  const stored = await browser.storage.local.get(DEFAULTS);
  const value = stored[DEFAULTS];
  return typeof value === "object" && value !== null ? value : {};
}

export async function rememberDefaults(draft: WatchDraft): Promise<void> {
  const { topic, server, token, priority } = draft;
  await browser.storage.local.set({ [DEFAULTS]: { topic, server, token, priority } });
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
