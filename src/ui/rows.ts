// Watch rows for the popup: the full row under "On this page" and the compact
// one under "Other watches". The row opens the watch; the switch turns it on or off.
import type { Watch } from "../core/watch.js";
import { patchWatch } from "../storage.js";
import { dot, lineEl, priorityPill, switchButton } from "./controls.js";
import { attrs, el } from "./dom.js";
import type { Line, WatchState } from "./text.js";

export type RowHandlers = { onOpen: (watch: Watch) => void };

/** Switching one back on starts it watching from here, not from what is already on the page. */
export async function setEnabled(watch: Pick<Watch, "id">, on: boolean): Promise<void> {
  await patchWatch(
    watch.id,
    on ? { enabled: true, watchingSince: Date.now() } : { enabled: false },
  );
}

/** Keyed, so a re-render after the switch writes storage can hand focus back to it. */
export function watchSwitch(watch: Watch): HTMLButtonElement {
  const toggle = switchButton(`Watch ${watch.selector}`, watch.enabled, (on) => {
    void setEnabled(watch, on);
  });
  return attrs(toggle, { "data-key": `switch:${watch.id}` });
}

type RowParts = {
  watch: Watch;
  state: WatchState;
  line: Line;
  compact: boolean;
  handlers: RowHandlers;
};

export function watchRow({ watch, state, line, compact, handlers }: RowParts): HTMLElement {
  const main = attrs(el("button", { type: "button", className: "row-main" }), {
    "data-key": `open:${watch.id}`,
  });
  main.append(
    dot(state),
    el("span", { className: "grow" }, [
      el("span", { className: "t-strong mono", textContent: watch.selector }),
      lineEl(line),
    ]),
  );
  main.addEventListener("click", () => {
    handlers.onOpen(watch);
  });
  const pill = compact ? [] : [priorityPill(watch.priority)];
  return el("div", { className: compact ? "row compact" : "row" }, [
    main,
    ...pill,
    watchSwitch(watch),
  ]);
}
