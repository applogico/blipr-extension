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

const form = need<HTMLFormElement>("#watch-form");
const panel = need<HTMLElement>("#panel");
const picking = need<HTMLElement>("#picking");
const chips = need<HTMLElement>("#picked");
const errors = need<HTMLElement>("#form-errors");
const result = need<HTMLElement>("#result");
const checkResult = need<HTMLElement>("#check-result");
const current = need<HTMLElement>("#current");
const list = need<HTMLElement>("#watches");

let page: PageTab;

void main();

async function main(): Promise<void> {
  need("#options").addEventListener("click", openOptions);
  const tab = await watchableTab();
  if (!tab) {
    panel.hidden = true;
    need<HTMLElement>("#blocked").hidden = false;
    return;
  }
  page = tab;
  await restore();
  form.addEventListener("submit", onSubmit);
  need("#pick").addEventListener("click", () => void onPick());
  need("#check").addEventListener("click", () => void onCheck());
  need("#site").addEventListener("click", widen);
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

async function onPick(): Promise<void> {
  await stashDraft(page.id, currentDraft());
  try {
    await send({ kind: "armPicker", tabId: page.id });
  } catch {
    show(result, UNREACHABLE, "bad");
    return;
  }
  panel.hidden = true;
  picking.hidden = false;
}

async function onCheck(): Promise<void> {
  const selector = currentDraft().selector;
  if (!selector) {
    show(checkResult, "Type or pick a selector first.", "warn");
    return;
  }
  const matches = await count(selector);
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
  const counts = await Promise.all(choices.map((choice) => count(choice.selector)));
  chips.replaceChildren(
    ...choices.map((choice, index) =>
      chip(choice, counts[index] ?? null, () => choose(choices, counts, index)),
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
  const counted = await Promise.all(watches.map((watch) => count(watch.selector)));
  const pairs = watches.map((watch, index) => [watch.selector, counted[index] ?? 0] as const);
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
async function count(selector: string): Promise<number | null> {
  const counted = await send({ kind: "countMatches", tabId: page.id, selector }).catch(() => null);
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
