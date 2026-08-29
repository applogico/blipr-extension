// The optional timed page reload. One alarm ticks for every watch that wants
// one, and each tick asks storage which watches are due: the worker is gone
// between ticks, so nothing may live in a variable.
import browser from "webextension-polyfill";

import { originPattern } from "../core/origins.js";
import { isDue, tickMinutes } from "../core/refresh.js";
import { matchesUrl } from "../core/urlmatch.js";
import type { Watch } from "../core/watch.js";
import { getWatches, patchWatch } from "../storage.js";

const ALARM = "blipr-refresh";

/** Creating an alarm restarts its period, so an alarm that already fits is left alone. */
export async function scheduleRefreshes(): Promise<void> {
  const minutes = tickMinutes(await getWatches());
  const existing = await browser.alarms.get(ALARM);
  if (minutes === null) {
    if (existing) await browser.alarms.clear(ALARM);
    return;
  }
  if (existing?.periodInMinutes === minutes) return;
  await browser.alarms.create(ALARM, { delayInMinutes: minutes, periodInMinutes: minutes });
}

export async function onAlarm(alarm: browser.Alarms.Alarm): Promise<void> {
  if (alarm.name !== ALARM) return;
  const now = Date.now();
  const watches = await getWatches();
  // One at a time: two reloads writing the watch list at once would lose one of the stamps.
  for (const watch of watches) {
    if (isDue(watch, now)) await refresh(watch, now);
  }
}

async function refresh(watch: Watch, now: number): Promise<void> {
  // Stamped even when no tab is open, so opening one later is not met with an instant reload.
  await patchWatch(watch.id, { lastRefreshedAt: now });
  await Promise.all((await watchedTabs(watch)).map(reload));
}

/** The active tab is the one being looked at: it is not throttled, and reloading it is rude. */
async function watchedTabs(watch: Watch): Promise<number[]> {
  const origin = originPattern(watch.urlPattern);
  if (!origin) return [];
  const tabs = await browser.tabs.query({ url: origin, active: false }).catch(() => []);
  return tabs.flatMap((tab) =>
    tab.id !== undefined && matchesUrl(watch.urlPattern, tab.url ?? "") ? [tab.id] : [],
  );
}

/** A tab that closed between the query and the reload is not an error. */
function reload(tabId: number): Promise<void> {
  return browser.tabs.reload(tabId).catch(() => undefined);
}
