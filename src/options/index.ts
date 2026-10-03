// The full page: every watch grouped by site, and the settings that are not
// per watch. The two tabs are hash routes, so the popup can open either one.
import browser from "webextension-polyfill";

import { matchesUrl } from "../core/urlmatch.js";
import type { Watch } from "../core/watch.js";
import { DEFAULT_SERVER } from "../core/watch.js";
import { send } from "../messages.js";
import { getConnection, getDefaults, getWatches } from "../storage.js";
import { connectionPillEl } from "../ui/controls.js";
import { need } from "../ui/dom.js";
import { mountEditor } from "../ui/editor.js";
import { toDraft } from "../ui/form.js";
import { openTabUrls } from "../ui/tab.js";
import { connectionPill } from "../ui/text.js";
import { renderSettings, renderSites, openTab } from "./settings.js";
import { watchesContent } from "./watches.js";

type Route = "watches" | "settings";

const panels: Record<Route, HTMLElement> = {
  watches: need("#watches", HTMLElement),
  settings: need("#settings", HTMLElement),
};
const tabs: Record<Route, HTMLElement> = {
  watches: need("#tab-watches", HTMLElement),
  settings: need("#tab-settings", HTMLElement),
};
const dialog = need("#edit-dialog", HTMLDialogElement);
const editorRoot = need("#editor", HTMLElement);
const conn = need("#conn", HTMLElement);
let renders = 0;

void main();

async function main(): Promise<void> {
  window.addEventListener("hashchange", route);
  route();
  const rerender = () => void render();
  browser.storage.onChanged.addListener(rerender);
  browser.permissions.onAdded.addListener(rerender);
  browser.permissions.onRemoved.addListener(rerender);
  browser.tabs.onUpdated.addListener(rerender);
  browser.tabs.onRemoved.addListener(rerender);
  dialog.addEventListener("close", () => {
    editorRoot.replaceChildren();
  });
  await render();
}

function route(): void {
  const current: Route = location.hash === "#settings" ? "settings" : "watches";
  for (const name of ["watches", "settings"] as const) {
    panels[name].hidden = name !== current;
    if (name === current) tabs[name].setAttribute("aria-current", "page");
    else tabs[name].removeAttribute("aria-current");
  }
  need("#page-title", HTMLElement).textContent = current === "settings" ? "Settings" : "Watches";
}

async function render(): Promise<void> {
  const ticket = (renders += 1);
  const [watches, defaults, check, openUrls] = await Promise.all([
    getWatches(),
    getDefaults(),
    getConnection(),
    openTabUrls(),
  ]);
  if (ticket !== renders) return;
  const pill = connectionPillEl(connectionPill(check, defaults.server ?? DEFAULT_SERVER));
  conn.replaceChildren(...(pill ? [pill] : []));
  const key =
    document.activeElement instanceof HTMLElement ? document.activeElement.dataset.key : undefined;
  panels.watches.replaceChildren(
    ...watchesContent(watches, openUrls, {
      onEdit: (watch) => void edit(watch),
      onOpenSite: (url) => void openTab(url),
    }),
  );
  if (key) panels.watches.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  renderSettings(defaults, check);
  await renderSites(watches, openUrls);
}

async function edit(watch: Watch): Promise<void> {
  const defaults = await getDefaults();
  const close = () => {
    dialog.close();
  };
  mountEditor(
    editorRoot,
    {
      pickable: false,
      markSrc: "../icons/blipr-mark.svg",
      count: (selector, containsText) => countOnOpenTab(watch.urlPattern, selector, containsText),
      onBack: close,
      onSaved: close,
      onDeleted: close,
    },
    { draft: toDraft(watch), defaults },
  );
  if (!dialog.open) dialog.showModal();
}

/** The options page has no page of its own, so it counts on an open tab of the watch's site. */
async function countOnOpenTab(
  urlPattern: string,
  selector: string,
  containsText: string,
): Promise<number | null> {
  const tabs = await browser.tabs.query({}).catch(() => []);
  const tab = tabs.find((each) => each.id !== undefined && matchesUrl(urlPattern, each.url ?? ""));
  if (tab?.id === undefined) return null;
  const counted = await send({ kind: "countMatches", tabId: tab.id, selector, containsText }).catch(
    () => null,
  );
  return counted && "matches" in counted ? counted.matches : null;
}
