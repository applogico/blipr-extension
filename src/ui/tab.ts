import browser from "webextension-polyfill";

import { isWatchableUrl } from "./sites.js";

export type PageTab = { id: number; url: string; watchable: boolean };

/** Content scripts cannot run on browser pages, the stores, PDFs, or saved files. */
export async function activeTab(): Promise<PageTab | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  const url = tab.url ?? "";
  return { id: tab.id, url, watchable: isWatchableUrl(url) };
}

/** Every URL Blipr can see in an open tab: the ones it has access to, which is all a watch needs. */
export async function openTabUrls(): Promise<string[]> {
  const tabs = await browser.tabs.query({}).catch(() => []);
  return tabs.flatMap((tab) => (tab.url ? [tab.url] : []));
}

/** Opens a page in the background, so the popup or options page stays where it is. */
export async function openInBackground(url: string): Promise<void> {
  await browser.tabs.create({ url, active: false });
}

export async function openOptions(section: "watches" | "settings"): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL(`options/options.html#${section}`) });
}
