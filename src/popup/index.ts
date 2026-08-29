// The toolbar popup: build a watch for the tab you are on. It never publishes
// and never registers anything — the background does that — but it does ask
// for host access, which only a user gesture is allowed to do.
import browser from "webextension-polyfill";

import type { SelectorPick } from "../core/selector.js";
import { matchesUrl, suggestPattern } from "../core/urlmatch.js";
import type { WatchDraft } from "../core/watch.js";
import { validate } from "../core/watch.js";
import { send } from "../messages.js";
import { forgetTab, getDefaults, getWatch, getWatches, stashDraft, takeDraft } from "../storage.js";
import { requestAccess } from "../ui/access.js";
import { el, listErrors, need, show } from "../ui/dom.js";
import { blankDraft, draftFrom, fillForm, readForm } from "../ui/form.js";
import { renderList, rowAction } from "../ui/list.js";
import { REFRESH_TOGGLE, toggleRefresh } from "../ui/refresh.js";
import type { PageTab } from "../ui/tab.js";
import { watchableTab } from "../ui/tab.js";
import { matchLabel, matchPhrase } from "../ui/text.js";

type Choice = { label: string; selector: string; strict: boolean };

const UNREACHABLE = "Blipr cannot reach this page. Reload it, then try again.";

const form = need("#watch-form", HTMLFormElement);
const panel = need("#panel", HTMLElement);
const picking = need("#picking", HTMLElement);
const chips = need("#picked", HTMLElement);
const errors = need("#form-errors", HTMLElement);
const result = need("#result", HTMLElement);
const checkResult = need("#check-result", HTMLElement);
const pickResult = need("#pick-result", HTMLElement);
const current = need("#current", HTMLElement);
const list = need("#watches", HTMLElement);

let page: PageTab;

void main();

async function main(): Promise<void> {
  need("#options", HTMLElement).addEventListener("click", openOptions);
  const tab = await watchableTab();
  if (!tab) {
    panel.hidden = true;
    need("#blocked", HTMLElement).hidden = false;
    return;
  }
  page = tab;
  await restore();
  form.addEventListener("submit", onSubmit);
  // Parked on every committed edit, so the form survives the popup closing under a prompt.
  form.addEventListener("change", () => void stashDraft(page.id, currentDraft()));
  need("#pick", HTMLElement).addEventListener("click", onPick);
  need("#check", HTMLElement).addEventListener("click", () => void onCheck());
  need("#site", HTMLElement).addEventListener("click", widen);
  list.addEventListener("click", (event) => void onRowAction(event));
  await refresh();
}

/** Picking, and a permission prompt on Chrome, both close the popup mid-edit. */
async function restore(): Promise<void> {
  const [parked, pick] = await Promise.all([
    takeDraft(page.id),
    send({ kind: "takePick", tabId: page.id }),
  ]);
  const base = parked ?? blankDraft(await getDefaults(), suggestPattern(page.url));
  fillForm(form, pick ? { ...base, selector: pick.unique } : base);
  if (pick) await offer(pick);
}

function onSubmit(event: Event): void {
  event.preventDefault();
  const draft = currentDraft();
  const problems = validate(draft);
  listErrors(errors, problems);
  if (problems.length > 0) return;
  // Chrome closes the popup under its own permission prompt, so the draft is
  // parked without awaiting: an await here would spend the gesture that
  // `permissions.request` needs.
  void stashDraft(page.id, draft);
  void save(draft);
}

async function save(draft: WatchDraft): Promise<void> {
  const access = await requestAccess(draft.urlPattern);
  if ("error" in access) {
    show(result, access.error, "bad");
    return;
  }
  const outcome = await send({ kind: "saveWatch", draft });
  if ("error" in outcome) {
    show(result, outcome.error, "bad");
    return;
  }
  await forgetTab(page.id);
  show(result, "Watch saved. Blipr is watching this page now.", "good");
  await refresh();
}

/**
 * Picking is where access is asked for. Both engines only allow a permission
 * prompt from a user gesture, and on Chrome that prompt closes the popup —
 * which picking does anyway, so the two interruptions collapse into one and
 * saving afterwards needs no prompt at all.
 */
function onPick(): void {
  const draft = currentDraft();
  // Nothing is awaited first: an await would spend the gesture the prompt needs,
  // and nothing after it runs once Chrome has closed this popup.
  void stashDraft(page.id, draft);
  void pick(draft);
}

async function pick(draft: WatchDraft): Promise<void> {
  const [access, armed] = await Promise.all([requestAccess(draft.urlPattern), armPicker()]);
  if (!armed) {
    show(result, UNREACHABLE, "bad");
    return;
  }
  panel.hidden = true;
  picking.hidden = false;
  if ("error" in access) show(pickResult, access.error, "bad");
}

/** The picker runs on the active tab either way; access is what the watch needs later. */
function armPicker(): Promise<boolean> {
  return send({ kind: "armPicker", tabId: page.id }).then(
    () => true,
    () => false,
  );
}

async function onCheck(): Promise<void> {
  const draft = currentDraft();
  if (!draft.selector) {
    show(checkResult, "Type or pick a selector first.", "warn");
    return;
  }
  const matches = await count(draft.selector, draft.containsText ?? "");
  if (matches === null) {
    show(checkResult, UNREACHABLE, "bad");
    return;
  }
  show(checkResult, matchPhrase(matches), matches > 0 ? "good" : "warn");
}

/** A pick offers the one element and everything like it: a watch is about the set. */
async function offer(pick: SelectorPick): Promise<void> {
  const choices: Choice[] = [{ label: "This element", selector: pick.unique, strict: true }];
  if (pick.similar && pick.similar.selector !== pick.unique) {
    choices.push({ label: "All similar", selector: pick.similar.selector, strict: false });
  }
  const containsText = currentDraft().containsText ?? "";
  const counts = await Promise.all(choices.map((choice) => count(choice.selector, containsText)));
  chips.replaceChildren(
    ...choices.map((choice, index) =>
      chip(choice, counts[index] ?? null, () => {
        choose(choices, counts, index);
      }),
    ),
  );
  chips.hidden = choices.length < 2;
  choose(choices, counts, 0);
}

function chip(choice: Choice, matches: number | null, onChoose: () => void): HTMLElement {
  const suffix = matches === null ? "" : ` · ${matchLabel(matches)}`;
  const node = el("button", {
    type: "button",
    className: "secondary",
    textContent: `${choice.label}${suffix}`,
  });
  node.addEventListener("click", onChoose);
  return node;
}

function choose(choices: Choice[], counts: Array<number | null>, index: number): void {
  const choice = choices[index];
  if (!choice) return;
  const matches = counts[index] ?? null;
  setField("selector", choice.selector);
  show(checkResult, picked(choice, matches), matches ? "good" : "warn");
  [...chips.children].forEach((node, at) => {
    node.setAttribute("aria-pressed", String(at === index));
  });
}

function picked(choice: Choice, matches: number | null): string {
  if (matches === null) return "Picked from the page.";
  if (choice.strict && matches > 1) {
    return `Picked, but this is the closest Blipr got: ${matchPhrase(matches)}`;
  }
  return `Picked from the page. ${matchPhrase(matches)}`;
}

async function refresh(): Promise<void> {
  const watches = (await getWatches()).filter((watch) => matchesUrl(watch.urlPattern, page.url));
  current.hidden = watches.length === 0;
  if (watches.length === 0) return;
  const counted = await Promise.all(
    watches.map((watch) => count(watch.selector, watch.containsText ?? "")),
  );
  const pairs = watches.map((watch, index) => [watch.id, counted[index] ?? 0] as const);
  renderList(list, watches, { actions: [REFRESH_TOGGLE], counts: Object.fromEntries(pairs) });
}

/** Starting and stopping the reloads is the one thing a row here can do. */
async function onRowAction(event: Event): Promise<void> {
  const hit = rowAction(event);
  if (hit?.action !== "refresh") return;
  const watch = await getWatch(hit.id);
  if (!watch) return;
  await toggleRefresh(watch);
  await refresh();
}

/** null when the page cannot be reached at all, which is not the same as zero. */
async function count(selector: string, containsText: string): Promise<number | null> {
  const counted = await send({
    kind: "countMatches",
    tabId: page.id,
    selector,
    containsText,
  }).catch(() => null);
  if (!counted || "error" in counted) return null;
  return counted.matches;
}

function currentDraft(): WatchDraft {
  return draftFrom(readForm(form));
}

function widen(): void {
  setField("urlPattern", `${new URL(page.url).origin}/*`);
}

function setField(name: string, value: string): void {
  const node = form.elements.namedItem(name);
  if (node instanceof HTMLInputElement) node.value = value;
}

function openOptions(): void {
  void browser.runtime.openOptionsPage();
  window.close();
}
