import browser from "webextension-polyfill";

export type PageTab = { id: number; url: string };

/** Content scripts cannot run on browser pages, the web store, or the extension's own pages. */
export async function watchableTab(): Promise<PageTab | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  if (tab?.id === undefined || !/^https?:\/\//i.test(url)) return null;
  return { id: tab.id, url };
}
