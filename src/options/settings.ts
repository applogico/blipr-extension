// The Settings tab: the server and its connection check, the defaults a new
// watch starts from, and the sites Blipr has been allowed to read.
import browser from "webextension-polyfill";

import { originPattern } from "../core/origins.js";
import type { Watch } from "../core/watch.js";
import {
  COOLDOWN_STEP_SECONDS,
  DEFAULT_PRIORITY,
  DEFAULT_SERVER,
  MAX_COOLDOWN_SECONDS,
  MIN_COOLDOWN_SECONDS,
  clampCooldown,
} from "../core/watch.js";
import { send } from "../messages.js";
import type { ConnectionCheck, WatchDefaults } from "../storage.js";
import { getDefaults, getWatches, patchWatches, setDefaults } from "../storage.js";
import { PRIORITY_CHOICES, dot, lineEl, segmented } from "../ui/controls.js";
import { attrs, el, need } from "../ui/dom.js";
import { isOpen, openableUrl, siteOf } from "../ui/sites.js";
import { stepper } from "../ui/stepper.js";
import { checkResultLine, siteAccessLine } from "../ui/text.js";

const COOLDOWN_BOUNDS = {
  min: MIN_COOLDOWN_SECONDS,
  max: MAX_COOLDOWN_SECONDS,
  step: COOLDOWN_STEP_SECONDS,
};

const server = need("#server", HTMLInputElement);
const serverError = need("#server-error", HTMLElement);
const topic = need("#default-topic", HTMLInputElement);
const checkResult = need("#check-result", HTMLElement);
const sites = need("#sites", HTMLElement);

let wired = false;

/** Fills the controls, without clobbering a field the user is typing in. */
export function renderSettings(defaults: WatchDefaults, check: ConnectionCheck | null): void {
  if (!wired) wire(defaults);
  wired = true;
  const current = defaults.server ?? DEFAULT_SERVER;
  if (document.activeElement !== server) server.value = current;
  if (document.activeElement !== topic) topic.value = defaults.topic ?? "";
  renderCheck(check?.server === current ? check : null);
}

function wire(defaults: WatchDefaults): void {
  server.addEventListener("change", () => void saveServer());
  topic.addEventListener("change", () => void setDefaults({ topic: topic.value.trim() }));
  need("#check", HTMLButtonElement).addEventListener("click", () => void check());
  need("#cooldown", HTMLElement).replaceChildren(
    stepper({
      label: "Cooldown",
      value: clampCooldown(defaults.cooldownSeconds),
      bounds: COOLDOWN_BOUNDS,
      onChange: (value) => void setDefaults({ cooldownSeconds: value }),
    }),
    el("span", { className: "sub unit", textContent: "seconds" }),
  );
  need("#default-priority", HTMLElement).replaceChildren(
    segmented({
      name: "default-priority",
      legend: "Priority",
      choices: PRIORITY_CHOICES,
      value: String(defaults.priority ?? DEFAULT_PRIORITY),
      onChange: (value) => void setDefaults({ priority: Number(value) }),
      className: "pri5",
    }),
  );
}

function renderCheck(check: ConnectionCheck | null): void {
  if (!check) {
    checkResult.replaceChildren();
    return;
  }
  checkResult.replaceChildren(
    el("span", { className: check.ok ? "ok" : "ok bad" }, [
      dot(check.ok ? "on" : "error"),
      checkResultLine(check),
    ]),
  );
}

async function check(): Promise<void> {
  const button = need("#check", HTMLButtonElement);
  button.disabled = true;
  try {
    renderCheck(
      await send({ kind: "checkConnection", server: server.value.trim() || DEFAULT_SERVER }),
    );
  } finally {
    button.disabled = false;
  }
}

/** A new server moves every watch that was on the old one, then asks the new one. */
async function saveServer(): Promise<void> {
  const next = server.value.trim().replace(/\/+$/, "") || DEFAULT_SERVER;
  if (!isHttp(next)) {
    serverError.textContent = "The server must be an http(s) URL.";
    serverError.hidden = false;
    return;
  }
  serverError.hidden = true;
  const old = (await getDefaults()).server ?? DEFAULT_SERVER;
  const moving = (await getWatches())
    .filter((watch) => watch.server === old)
    .map((watch) => watch.id);
  await patchWatches(moving, { server: next });
  await setDefaults({ server: next });
  await check();
}

function isHttp(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function renderSites(watches: Watch[], openUrls: string[]): Promise<void> {
  const granted = (await browser.permissions.getAll()).origins ?? [];
  const origins = granted.filter((origin) => origin.includes("://"));
  if (origins.length === 0) {
    sites.replaceChildren(
      el("div", { className: "row" }, [
        el("span", {
          className: "sub",
          textContent: "No sites yet. Saving a watch asks for its site.",
        }),
      ]),
    );
    return;
  }
  sites.replaceChildren(...origins.map((origin) => siteRow(origin, watches, openUrls)));
}

function siteRow(origin: string, watches: Watch[], openUrls: string[]): HTMLElement {
  const mine = watches.filter((watch) => originPattern(watch.urlPattern) === origin);
  const open = isOpen(origin, openUrls);
  const enabled = mine.filter((watch) => watch.enabled).length;
  const site = siteOf(origin);
  const url = openableUrl(origin);
  const actions: HTMLElement[] = [];
  if (!open && url) actions.push(ghost("Open", `Open ${site} in a tab`, () => void openTab(url)));
  actions.push(ghost("Remove", `Remove ${site}`, () => void remove(origin, mine)));
  return el("div", { className: "row site-row" }, [
    el("div", { className: "grow" }, [
      el("span", { className: "mono t-strong", textContent: site }),
      lineEl(siteAccessLine(open, enabled)),
    ]),
    ...actions,
  ]);
}

function ghost(text: string, label: string, onClick: () => void): HTMLElement {
  const button = attrs(
    el("button", { type: "button", className: "btn ghost", textContent: text }),
    {
      "aria-label": label,
    },
  );
  button.addEventListener("click", onClick);
  return button;
}

export async function openTab(url: string): Promise<void> {
  await browser.tabs.create({ url, active: false });
}

/** Turning the watches off first means none is left pointing at a site Blipr cannot read. */
async function remove(origin: string, watches: Watch[]): Promise<void> {
  await patchWatches(
    watches.map((watch) => watch.id),
    { enabled: false },
  );
  await browser.permissions.remove({ origins: [origin] });
}
