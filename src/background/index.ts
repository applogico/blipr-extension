// Every message lands here, and every network call and every stored setting
// lives behind it. The one thing it cannot do is ask for host access: both
// engines only allow that from a user gesture, so the popup and the options
// page request it and this checks that it was granted before saving.
import browser from "webextension-polyfill";

import { hostOf, originPattern } from "../core/origins.js";
import { matchesUrl } from "../core/urlmatch.js";
import type { Watch, WatchDraft } from "../core/watch.js";
import { validate } from "../core/watch.js";
import type { Responses } from "../messages.js";
import { onMessage, sendToTab } from "../messages.js";
import {
  forgetTab,
  getWatch,
  getWatches,
  patchWatch,
  putWatch,
  rememberDefaults,
  stashPick,
  takePick,
  WATCHES,
} from "../storage.js";
import { setPickBadge } from "./badge.js";
import { TEST_BLIP, attempt, fire } from "./blip.js";
import { onAlarm, scheduleRefreshes } from "./refresh.js";
import { ensureContentScript, injectInto, syncContentScripts } from "./registration.js";

const UNREACHABLE = "Blipr cannot reach this page. Reload it, then try again.";
const VAGUE_PATTERN =
  "Blipr cannot tell which site that pattern covers. Give it a host and a path, like https://example.com/*.";

onMessage({
  watchesForUrl: async ({ url }) => {
    const watches = await getWatches();
    return watches.filter((watch) => watch.enabled && matchesUrl(watch.urlPattern, url)).map(live);
  },

  conditionMet: async ({ watchId, matches, url }) => {
    const watch = await getWatch(watchId);
    if (watch) await fire(watch, { matches, url });
  },

  watchError: async ({ watchId, error }) => {
    await patchWatch(watchId, { lastError: error });
  },

  armPicker: async ({ tabId }) => {
    await ensureContentScript(tabId);
    await sendToTab(tabId, { kind: "armPicker", tabId });
  },

  pickResult: async ({ tabId, pick }, sender) => {
    const id = sender.tab?.id ?? tabId;
    await stashPick(id, pick);
    await setPickBadge(id, true);
  },

  takePick: async ({ tabId }) => {
    await setPickBadge(tabId, false);
    return takePick(tabId);
  },

  countMatches: async ({ tabId, selector }) => {
    try {
      await ensureContentScript(tabId);
      return await sendToTab(tabId, { kind: "countMatches", tabId, selector });
    } catch {
      return { error: UNREACHABLE };
    }
  },

  saveWatch: ({ draft }) => save(draft),

  testWatch: async ({ draft }) => {
    const outcome = await attempt(draft, TEST_BLIP);
    return outcome.ok ? { ok: true } : { error: outcome.message };
  },
});

browser.runtime.onStartup.addListener(() => void catchUp());
browser.runtime.onInstalled.addListener(() => void catchUp());
browser.permissions.onAdded.addListener(() => void syncContentScripts());
browser.permissions.onRemoved.addListener(() => void syncContentScripts());
browser.tabs.onRemoved.addListener((tabId) => void forgetTab(tabId));
browser.alarms.onAlarm.addListener((alarm) => void onAlarm(alarm));
browser.storage.onChanged.addListener((changes, area) => {
  // Remembering the last-used defaults is not a reason to re-register anything.
  if (area === "local" && WATCHES in changes) void catchUp();
});

/** Where the watches run, and how often they reload, both follow the watch list. */
async function catchUp(): Promise<void> {
  await syncContentScripts();
  await scheduleRefreshes();
}

async function save(draft: WatchDraft): Promise<Responses["saveWatch"]> {
  const problems = validate(draft);
  if (problems.length > 0) return { error: problems.join(" ") };

  const origin = originPattern(draft.urlPattern);
  if (!origin) return { error: VAGUE_PATTERN };
  if (!(await browser.permissions.contains({ origins: [origin] }))) {
    return { error: `Blipr has no access to ${hostOf(origin)}, so that watch could never run.` };
  }

  const watch = await settled(draft);
  await putWatch(watch);
  await rememberDefaults(draft);
  await syncContentScripts();
  await injectInto(origin);
  return { saved: watch };
}

/** Saving is a fix, so the stale error and the cooldown a failed publish left go with it. */
async function settled(draft: WatchDraft): Promise<Watch> {
  const { id, ...fields } = draft;
  const existing = id ? await getWatch(id) : null;
  const now = Date.now();
  return {
    ...fields,
    id: id ?? crypto.randomUUID(),
    enabled: existing?.enabled ?? true,
    // It watches from here on, so it never blips for what was already on the page.
    watchingSince: now,
    // The refresh clock starts at the save too, so the first reload is a whole interval away.
    ...(fields.refresh ? { lastRefreshedAt: now } : {}),
  };
}

/** All a content script is ever told about a watch: no topic, no server. */
function live(watch: Watch): Responses["watchesForUrl"][number] {
  const { id, selector, condition, watchingSince } = watch;
  return {
    id,
    selector,
    condition,
    ...(watchingSince === undefined ? {} : { watchingSince }),
  };
}
