import type { Watch } from "../core/watch.js";
import { el } from "./dom.js";
import { matchLabel, statusText, summaryLabel } from "./text.js";

export type RowAction = {
  action: string;
  text: string | ((watch: Watch) => string);
  /** Left off the row entirely when it would have nothing to act on. */
  when?: (watch: Watch) => boolean;
};

/** The row button a click landed on, if it was one. */
export function rowAction(event: Event): { action: string; id: string } | null {
  const target = event.target;
  const button =
    target instanceof Element ? target.closest<HTMLElement>("button[data-action]") : null;
  const id = button?.dataset.id;
  if (!button || id === undefined) return null;
  return { action: button.dataset.action ?? "", id };
}

type Options = { actions?: RowAction[]; counts?: Record<string, number> };

export function renderList(root: HTMLElement, watches: Watch[], options: Options = {}): void {
  if (watches.length === 0) {
    root.replaceChildren(el("p", { className: "empty", textContent: "No watches yet." }));
    return;
  }
  root.replaceChildren(...watches.map((watch) => row(watch, options)));
}

function row(watch: Watch, { actions = [], counts }: Options): HTMLElement {
  const live = counts?.[watch.id];
  const offered = actions.filter((action) => action.when?.(watch) ?? true);
  return el("article", { className: watch.enabled ? "watch" : "watch off" }, [
    el("div", { className: "watch-head" }, [
      el("strong", { textContent: watch.topic }),
      el("span", { className: "badge", textContent: summaryLabel(watch) }),
    ]),
    el("code", { textContent: watch.selector }),
    ...(live === undefined
      ? []
      : [el("span", { className: "badge", textContent: `matches ${matchLabel(live)} now` })]),
    el("span", { className: "url", textContent: watch.urlPattern }),
    el("p", {
      className: watch.lastError ? "status bad" : "status",
      textContent: statusText(watch),
    }),
    ...(offered.length === 0
      ? []
      : [
          el(
            "div",
            { className: "row" },
            offered.map((action) => button(action, watch)),
          ),
        ]),
  ]);
}

function button({ action, text }: RowAction, watch: Watch): HTMLElement {
  const node = el("button", {
    type: "button",
    className: "secondary",
    textContent: typeof text === "function" ? text(watch) : text,
  });
  node.dataset.action = action;
  node.dataset.id = watch.id;
  return node;
}
