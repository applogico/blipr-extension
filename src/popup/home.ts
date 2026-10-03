// The popup's first screen, built from one snapshot of storage and the open
// tabs: what is watching this page, the pick button, and everything else.
import { matchesUrl } from "../core/urlmatch.js";
import type { Watch } from "../core/watch.js";
import type { ConnectionCheck } from "../storage.js";
import { calloutEl, dot, partsEl } from "../ui/controls.js";
import { attrs, el } from "../ui/dom.js";
import { watchRow } from "../ui/rows.js";
import { displayUrl, isOpen, siteOf } from "../ui/sites.js";
import type { PageTab } from "../ui/tab.js";
import { groupSummary, hereLine, offlineCallout, otherLine, stateOf } from "../ui/text.js";

export type Snapshot = {
  page: PageTab | null;
  watches: Watch[];
  connection: ConnectionCheck | null;
  server: string;
  othersOpen: boolean | undefined;
  openUrls: string[];
  toast: string | null;
  now: number;
};

export type HomeActions = {
  onPick: () => void;
  onPaste: () => void;
  onOpenWatch: (watch: Watch) => void;
  onToggleGroup: (open: boolean) => void;
  onSeeAll: () => void;
};

export function homeContent(snap: Snapshot, actions: HomeActions): HTMLElement[] {
  const top = [...offline(snap), ...toast(snap)];
  const { page } = snap;
  if (!page?.watchable) return [...top, blocked(), ...blockedGroup(snap, actions)];
  if (snap.watches.length === 0)
    return [...top, firstRun(), pickButton(actions), pasteLink(actions)];
  const here = snap.watches.filter((watch) => matchesUrl(watch.urlPattern, page.url));
  const others = snap.watches.filter((watch) => !here.includes(watch));
  const open = snap.othersOpen ?? here.length === 0;
  return [
    ...top,
    onThisPage(page, here, snap, actions),
    pickButton(actions),
    pasteLink(actions),
    ...(others.length === 0 ? [] : [group("Other watches", others, open, snap, actions)]),
  ];
}

function offline(snap: Snapshot): HTMLElement[] {
  const check = snap.connection;
  if (!check || check.ok || check.server !== snap.server) return [];
  return [calloutEl("bad", offlineCallout(check))];
}

function toast(snap: Snapshot): HTMLElement[] {
  if (!snap.toast) return [];
  return [attrs(el("div", { className: "toast" }, [dot("on"), snap.toast]), { role: "status" })];
}

function blocked(): HTMLElement {
  return calloutEl("info", {
    strong: "Blipr can't watch this page.",
    rest: "Browser pages, the extension store and saved files are off limits. Open a website, then click the Blipr icon again.",
  });
}

function blockedGroup(snap: Snapshot, actions: HomeActions): HTMLElement[] {
  if (snap.watches.length === 0) return [];
  // Opened every time: on a page Blipr cannot watch, this list is all there is.
  return [
    group("Your watches", snap.watches, true, snap, { ...actions, onToggleGroup: () => undefined }),
  ];
}

function firstRun(): HTMLElement {
  return el("div", { className: "card" }, [
    el("div", { className: "empty" }, [
      attrs(el("div", { className: "ring" }, [el("span")]), { "aria-hidden": "true" }),
      el("h2", { textContent: "Get a blip when a page changes" }),
      el("p", {
        textContent:
          "Pick something on this page, like a button or a status. Blipr tells your phone when it appears or goes away.",
      }),
    ]),
  ]);
}

function pickButton(actions: HomeActions): HTMLElement {
  const button = el("button", {
    type: "button",
    className: "btn primary wide lg",
    id: "pick",
    textContent: "Pick an element to watch",
  });
  button.addEventListener("click", actions.onPick);
  return button;
}

/** Quiet, under the main button: picking stays the obvious first step. */
function pasteLink(actions: HomeActions): HTMLElement {
  const button = el("button", {
    type: "button",
    className: "link",
    textContent: "Paste a shared watch",
  });
  button.addEventListener("click", actions.onPaste);
  return el("div", { className: "paste-link" }, [button]);
}

function onThisPage(
  page: PageTab,
  here: Watch[],
  snap: Snapshot,
  actions: HomeActions,
): HTMLElement {
  const list =
    here.length === 0
      ? el("div", { className: "card" }, [
          el("div", { className: "empty small" }, [
            el("p", { textContent: "Nothing is watching this page yet." }),
          ]),
        ])
      : el(
          "div",
          { className: "card rows" },
          here.map((watch) =>
            watchRow({
              watch,
              state: stateOf(watch, true),
              line: hereLine(watch, snap.now),
              compact: false,
              handlers: { onOpen: actions.onOpenWatch },
            }),
          ),
        );
  return el("section", { className: "field", ariaLabel: "On this page" }, [
    el("h2", { className: "label", textContent: "On this page" }),
    el("p", { className: "page-url", textContent: displayUrl(page.url), title: page.url }),
    list,
  ]);
}

function group(
  title: string,
  watches: Watch[],
  open: boolean,
  snap: Snapshot,
  actions: HomeActions,
): HTMLElement {
  const states = watches.map((watch) => stateOf(watch, isOpen(watch.urlPattern, snap.openUrls)));
  const header = attrs(el("button", { type: "button", className: "group-hd" }), {
    "aria-expanded": String(open),
    "data-key": "group",
  });
  header.append(
    attrs(el("span", { className: "caret" }), { "aria-hidden": "true" }),
    el("span", { className: "grow" }, [
      el("span", { className: "t-strong", textContent: title }),
      ...(open ? [] : [partsEl(groupSummary(states))]),
    ]),
    el("span", { className: "tag plain", textContent: String(watches.length) }),
  );
  header.addEventListener("click", () => {
    actions.onToggleGroup(!open);
  });
  if (!open) return el("div", { className: "card" }, [header]);
  return el("div", { className: "card rows" }, [
    header,
    ...watches.map((watch) => compactRow(watch, snap, actions)),
    seeAll(actions),
  ]);
}

function compactRow(watch: Watch, snap: Snapshot, actions: HomeActions): HTMLElement {
  const open = isOpen(watch.urlPattern, snap.openUrls);
  return watchRow({
    watch,
    state: stateOf(watch, open),
    line: otherLine(watch, siteOf(watch.urlPattern), open, snap.now),
    compact: true,
    handlers: { onOpen: actions.onOpenWatch },
  });
}

function seeAll(actions: HomeActions): HTMLElement {
  const button = el("button", {
    type: "button",
    className: "link",
    textContent: "See all watches",
  });
  button.addEventListener("click", actions.onSeeAll);
  return el("div", { className: "row foot-link" }, [button]);
}
