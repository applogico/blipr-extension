// The toolbar popup: what is watching this page, what else is running, and
// the form for a new or edited watch. It never publishes and never registers
// anything (the background does that), but it does ask for host access, which
// only a user gesture is allowed to do.
import browser from "webextension-polyfill";

import { isStale } from "../core/connection.js";
import type { SelectorPick } from "../core/selector.js";
import { matchesUrl, suggestPattern } from "../core/urlmatch.js";
import type { Watch, WatchDraft } from "../core/watch.js";
import { DEFAULT_SERVER } from "../core/watch.js";
import { send } from "../messages.js";
import type { WatchDefaults } from "../storage.js";
import {
  forgetTab,
  getConnection,
  getDefaults,
  getPrefs,
  getWatches,
  setPrefs,
  stashDraft,
  takeDraft,
} from "../storage.js";
import { requestAccess } from "../ui/access.js";
import { connectionPillEl } from "../ui/controls.js";
import { el, need, show } from "../ui/dom.js";
import { mountEditor } from "../ui/editor.js";
import { blankDraft, toDraft } from "../ui/form.js";
import type { PageTab } from "../ui/tab.js";
import { activeTab, openOptions, openTabUrls } from "../ui/tab.js";
import { connectionPill, savedToast } from "../ui/text.js";
import type { HomeActions } from "./home.js";
import { homeContent } from "./home.js";

const UNREACHABLE = "Blipr cannot reach this page. Reload it, then try again.";
const MARK = "../icons/blipr-mark.svg";

const home = need("#home", HTMLElement);
const homeBody = need("#home-body", HTMLElement);
const editorRoot = need("#editor", HTMLElement);
const conn = need("#conn", HTMLElement);

let page: PageTab | null = null;
let defaults: WatchDefaults = {};
let view: "home" | "editor" | "picking" = "home";
let toastText: string | null = null;
let renders = 0;

const ACTIONS: HomeActions = {
  onPick: startPickFromHome,
  onOpenWatch: (watch) => {
    openEditor(toDraft(watch));
  },
  onToggleGroup: (open) => void setPrefs({ othersOpen: open }),
  onSeeAll: () =>
    void openOptions("watches").then(() => {
      window.close();
    }),
};

void main();

/** The draft is already stashed per tab, so the editor comes back as it was. */
function openSettings(): void {
  void openOptions("settings").then(() => {
    window.close();
  });
}

async function main(): Promise<void> {
  need("#settings", HTMLElement).addEventListener("click", openSettings);
  page = await activeTab();
  defaults = await getDefaults();
  browser.storage.onChanged.addListener(() => void onStorage());
  if (!(page?.watchable && (await resume(page)))) await renderHome();
  void checkIfStale();
}

async function onStorage(): Promise<void> {
  defaults = await getDefaults();
  await renderHeader();
  if (view === "home") await renderHome();
}

/** Picking, and a permission prompt on Chrome, both close the popup mid-edit. */
async function resume(tab: PageTab): Promise<boolean> {
  const [parked, pick] = await Promise.all([
    takeDraft(tab.id),
    send({ kind: "takePick", tabId: tab.id }).catch(() => null),
  ]);
  if (!parked && !pick) return false;
  const base = parked ?? blankDraft(defaults, suggestPattern(tab.url));
  openEditor(base, pick);
  await renderHeader();
  return true;
}

async function renderHeader(): Promise<void> {
  const server = defaults.server ?? DEFAULT_SERVER;
  const pill = connectionPillEl(connectionPill(await getConnection(), server));
  conn.replaceChildren(...(pill ? [pill] : []));
}

async function renderHome(): Promise<void> {
  const ticket = (renders += 1);
  const [watches, connection, prefs, openUrls] = await Promise.all([
    getWatches(),
    getConnection(),
    getPrefs(),
    openTabUrls(),
  ]);
  if (ticket !== renders || view !== "home") return;
  const server = defaults.server ?? DEFAULT_SERVER;
  const snapshot = { page, watches, connection, server, openUrls, toast: toastText };
  const key =
    document.activeElement instanceof HTMLElement ? document.activeElement.dataset.key : undefined;
  homeBody.replaceChildren(
    ...homeContent({ ...snapshot, othersOpen: prefs.othersOpen, now: Date.now() }, ACTIONS),
  );
  if (key) homeBody.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  await renderHeader();
}

function showHome(toast: string | null = null): void {
  toastText = toast;
  view = "home";
  editorRoot.hidden = true;
  editorRoot.replaceChildren();
  home.hidden = false;
  void renderHome();
}

function openEditor(draft: WatchDraft, pick: SelectorPick | null = null): void {
  if (!page) return;
  const tab = page;
  view = "editor";
  home.hidden = true;
  editorRoot.hidden = false;
  const leave = (toast: string | null) => {
    void forgetTab(tab.id);
    showHome(toast);
  };
  mountEditor(
    editorRoot,
    {
      pageUrl: tab.url,
      pickable: tab.watchable && (draft.id === undefined || matchesUrl(draft.urlPattern, tab.url)),
      markSrc: MARK,
      count: (selector, containsText) => count(tab.id, selector, containsText),
      onPickAgain: startPick,
      onChange: (next) => void stashDraft(tab.id, next),
      onBack: () => {
        leave(null);
      },
      onOpenSettings: openSettings,
      onSaved: (watch: Watch) => {
        leave(savedToast(watch.selector));
      },
      onDeleted: () => {
        leave(null);
      },
    },
    { draft, defaults, pick },
  );
}

function startPickFromHome(): void {
  if (!page) return;
  startPick(blankDraft(defaults, suggestPattern(page.url)));
}

/**
 * Picking is where access is asked for. Both engines only allow a permission
 * prompt from a user gesture, and on Chrome that prompt closes the popup,
 * which picking does anyway, so the two interruptions collapse into one and
 * saving afterwards needs no prompt at all.
 */
function startPick(draft: WatchDraft): void {
  if (!page) return;
  // Nothing is awaited first: an await would spend the gesture the prompt needs.
  void stashDraft(page.id, draft);
  void pick(page, draft);
}

async function pick(tab: PageTab, draft: WatchDraft): Promise<void> {
  const [access, armed] = await Promise.all([
    requestAccess(draft.urlPattern),
    send({ kind: "armPicker", tabId: tab.id }).then(
      () => true,
      () => false,
    ),
  ]);
  if (!armed) void forgetTab(tab.id);
  showPicking(armed, "error" in access ? access.error : null);
}

function showPicking(armed: boolean, accessError: string | null): void {
  view = "picking";
  editorRoot.hidden = true;
  home.hidden = false;
  const result = el("p", { className: "result", hidden: true });
  const lead = armed
    ? [
        el("strong", { textContent: "Click the element to watch" }),
        el("p", {
          className: "hint",
          textContent:
            "Hovering outlines what you are about to pick. Escape cancels. When you have picked, open Blipr again: the selector will be waiting, with a count of what it matches.",
        }),
      ]
    : [];
  const problem = armed ? accessError : UNREACHABLE;
  if (problem) show(result, problem, "bad");
  homeBody.replaceChildren(el("div", { className: "card picking" }, [...lead, result]));
}

/** null when the page cannot be reached at all, which is not the same as zero. */
async function count(
  tabId: number,
  selector: string,
  containsText: string,
): Promise<number | null> {
  const counted = await send({ kind: "countMatches", tabId, selector, containsText }).catch(
    () => null,
  );
  if (!counted || "error" in counted) return null;
  return counted.matches;
}

/** The pill reads the last answer; an old or missing one is refreshed in the background. */
async function checkIfStale(): Promise<void> {
  const server = defaults.server ?? DEFAULT_SERVER;
  if (!isStale(await getConnection(), server, Date.now())) return;
  await send({ kind: "checkConnection", server }).catch(() => undefined);
}
