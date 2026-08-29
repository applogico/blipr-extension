// The full page: everything already saved, and one form to add or edit. Like
// the popup it asks for host access itself, because only a user gesture may.
import browser from "webextension-polyfill";

import type { Watch, WatchDraft } from "../core/watch.js";
import { validate } from "../core/watch.js";
import { send } from "../messages.js";
import { deleteWatch, getDefaults, getWatch, getWatches, patchWatch } from "../storage.js";
import { requestAccess } from "../ui/access.js";
import { listErrors, need, show } from "../ui/dom.js";
import { blankDraft, draftFrom, fillForm, readForm, toDraft } from "../ui/form.js";
import type { RowAction } from "../ui/list.js";
import { renderList, rowAction } from "../ui/list.js";
import { REFRESH_TOGGLE, toggleRefresh } from "../ui/refresh.js";

const ACTIONS: RowAction[] = [
  { action: "edit", text: "Edit" },
  { action: "test", text: "Send test blip" },
  REFRESH_TOGGLE,
  { action: "toggle", text: (watch) => (watch.enabled ? "Disable" : "Enable") },
  { action: "delete", text: "Delete" },
];

const form = need<HTMLFormElement>("#watch-form");
const list = need<HTMLElement>("#watches");
const errors = need<HTMLElement>("#form-errors");
const heading = need<HTMLElement>("#form-heading");
const result = need<HTMLElement>("#result");

let editing: string | null = null;

void main();

async function main(): Promise<void> {
  form.addEventListener("submit", onSubmit);
  need("#cancel").addEventListener("click", () => void reset());
  list.addEventListener("click", (event) => void onAction(event));
  browser.storage.onChanged.addListener(() => void refresh());
  await reset();
  await refresh();
}

function onSubmit(event: Event): void {
  event.preventDefault();
  const draft = draftFrom(readForm(form), editing ?? undefined);
  const problems = validate(draft);
  listErrors(errors, problems);
  // The gesture must reach `permissions.request`, so nothing is awaited before save().
  if (problems.length === 0) void save(draft);
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
  show(result, "Watch saved.", "good");
  await reset();
  await refresh();
}

async function onAction(event: Event): Promise<void> {
  const hit = rowAction(event);
  if (!hit) return;
  await run(hit.action, hit.id);
  await refresh();
}

async function run(action: string, id: string): Promise<void> {
  const watch = await getWatch(id);
  if (!watch) return;
  switch (action) {
    case "edit":
      return edit(watch);
    case "test":
      return test(watch);
    case "refresh":
      return toggleRefresh(watch);
    case "delete":
      return confirmDelete(watch);
    case "toggle":
      await patchWatch(id, { enabled: !watch.enabled });
  }
}

function edit(watch: Watch): void {
  editing = watch.id;
  fillForm(form, toDraft(watch));
  heading.textContent = "Edit watch";
  form.scrollIntoView({ behavior: "smooth" });
}

async function confirmDelete(watch: Watch): Promise<void> {
  if (!confirm(`Delete the watch on ${watch.topic}?`)) return;
  await deleteWatch(watch.id);
  if (editing === watch.id) await reset();
}

async function test(watch: Watch): Promise<void> {
  const outcome = await send({ kind: "testWatch", draft: toDraft(watch) });
  if ("error" in outcome) show(result, outcome.error, "bad");
  else show(result, "Test blip sent. Check your phone.", "good");
}

async function refresh(): Promise<void> {
  renderList(list, await getWatches(), { actions: ACTIONS });
}

async function reset(): Promise<void> {
  editing = null;
  heading.textContent = "Add a watch";
  listErrors(errors, []);
  fillForm(form, blankDraft(await getDefaults(), ""));
}
