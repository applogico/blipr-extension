import browser from "webextension-polyfill";

/** The popup is gone by the time a pick lands, so the toolbar icon says "come back". */
export async function setPickBadge(tabId: number, waiting: boolean): Promise<void> {
  await browser.action.setBadgeText({ tabId, text: waiting ? "✓" : "" }).catch(() => undefined);
}
