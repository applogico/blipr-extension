// The Watches tab: a warning when something failed, then every watch grouped
// by site, each group saying whether its page is open in a tab.
import type { Watch } from "../core/watch.js";
import { calloutEl, dot, lineEl, priorityPill } from "../ui/controls.js";
import { attrs, el } from "../ui/dom.js";
import { watchSwitch } from "../ui/rows.js";
import type { SiteGroup } from "../ui/sites.js";
import { groupBySite, isOpen, openableUrl } from "../ui/sites.js";
import { errorCallout, lastBlipLabel, optionsLine, plural, stateOf } from "../ui/text.js";

export type WatchesActions = {
  onEdit: (watch: Watch) => void;
  onOpenSite: (url: string) => void;
};

export function watchesContent(
  watches: Watch[],
  openUrls: string[],
  actions: WatchesActions,
): HTMLElement[] {
  if (watches.length === 0) return [empty()];
  const warning = errorCallout(watches);
  const now = Date.now();
  return [
    ...(warning ? [calloutEl("warn", warning)] : []),
    ...groupBySite(watches).map((group) => siteCard(group, openUrls, now, actions)),
  ];
}

function empty(): HTMLElement {
  return el("div", { className: "card" }, [
    el("div", { className: "empty" }, [
      el("h2", { textContent: "No watches yet." }),
      el("p", {
        textContent: "Open a page, click the Blipr icon, and pick an element to watch.",
      }),
    ]),
  ]);
}

function siteCard(
  group: SiteGroup,
  openUrls: string[],
  now: number,
  actions: WatchesActions,
): HTMLElement {
  const open = group.watches.some((watch) => isOpen(watch.urlPattern, openUrls));
  return el("section", { className: "card site-card", ariaLabel: group.site }, [
    siteHeader(group, open, actions),
    columns(),
    el(
      "div",
      { className: "rows" },
      group.watches.map((watch) =>
        gridRow(watch, isOpen(watch.urlPattern, openUrls), now, actions),
      ),
    ),
  ]);
}

function siteHeader(group: SiteGroup, open: boolean, actions: WatchesActions): HTMLElement {
  const count = plural(group.watches.length, "watch", "watches");
  const parts: HTMLElement[] = [
    el("h2", { textContent: group.site }),
    el("span", { className: "tag plain", textContent: count }),
    el("div", { className: "grow" }),
  ];
  const url = openableUrl(group.watches[0]?.urlPattern ?? "");
  if (open) parts.push(el("span", { className: "sub", textContent: "Open in a tab" }));
  else {
    parts.push(el("span", { className: "warn-line", textContent: "No tab open" }));
    if (url) parts.push(openButton(url, group.site, actions));
  }
  return el("div", { className: "site-hd" }, parts);
}

function openButton(url: string, site: string, actions: WatchesActions): HTMLElement {
  const button = attrs(el("button", { type: "button", className: "link", textContent: "Open" }), {
    "aria-label": `Open ${site} in a tab`,
  });
  button.addEventListener("click", () => {
    actions.onOpenSite(url);
  });
  return button;
}

function columns(): HTMLElement {
  const names = ["", "Element", "Topic", "Priority", "Last blip", "On"];
  const classes = ["", "", "col-topic", "", "col-last", ""];
  return attrs(
    el(
      "div",
      { className: "grid-row colhd" },
      names.map((name, index) =>
        el("span", { className: classes[index] ?? "", textContent: name }),
      ),
    ),
    { "aria-hidden": "true" },
  );
}

function gridRow(watch: Watch, open: boolean, now: number, actions: WatchesActions): HTMLElement {
  const state = stateOf(watch, open);
  const main = attrs(el("button", { type: "button", className: "cell-main" }), {
    "data-key": `open:${watch.id}`,
    "aria-label": `Edit ${watch.selector}`,
  });
  main.append(
    el("span", { className: "t-strong mono", textContent: watch.selector }),
    lineEl(optionsLine(watch, open)),
  );
  main.addEventListener("click", () => {
    actions.onEdit(watch);
  });
  return el("div", { className: "grid-row" }, [
    dot(state),
    main,
    el("span", { className: "col-topic" }, [
      el("span", { className: "tag", textContent: watch.topic }),
    ]),
    priorityPill(watch.priority),
    el("span", { className: "sub col-last", textContent: lastBlipLabel(watch, now) }),
    watchSwitch(watch),
  ]);
}
