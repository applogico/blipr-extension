// Share and paste, for the popup and the options page: copying a watch and the paste screen.
import type { Shareable, SharedWatch } from "../core/share.js";
import { parseShare, shareWatch } from "../core/share.js";
import { attrs, el } from "./dom.js";
import { hint, screenHeader } from "./editor-parts.js";

export const COPIED_MS = 3000;
const CALLOUT_MS = 8000;

/** Plain JSON on the clipboard; false when the browser refused. */
export async function copyWatch(watch: Shareable): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareWatch(watch));
    return true;
  } catch {
    return false;
  }
}

/** Shows `copied` on the button for a few seconds, then puts its label back. */
export function flipCopied(button: HTMLElement, label: string, copied: string): void {
  button.textContent = copied;
  button.classList.add("done");
  setTimeout(() => {
    button.textContent = label;
    button.classList.remove("done");
  }, COPIED_MS);
}

/** What went into the copy, so nobody wonders whether their topic went with it. */
export function copiedCallout(): HTMLElement {
  const callout = attrs(
    el("div", { className: "callout info copied" }, [
      el("div", { className: "grow" }, [
        el("b", { textContent: "Copied. Paste it to anyone who uses Blipr." }),
        el("div", { className: "incl" }, [
          attrs(el("span", { className: "y", textContent: "✓" }), { "aria-hidden": "true" }),
          el("span", {
            textContent:
              "Page, element, text, appears or gone, refresh, priority, cooldown, title and message",
          }),
          attrs(el("span", { className: "n", textContent: "×" }), { "aria-hidden": "true" }),
          el("span", { textContent: "Not your server or topic. They use their own." }),
        ]),
      ]),
    ]),
    { role: "status" },
  );
  setTimeout(() => {
    callout.remove();
  }, CALLOUT_MS);
  return callout;
}

export function sharedCallout(): HTMLElement {
  return attrs(
    el("div", { className: "callout info" }, [
      el("div", {}, [
        el("b", { textContent: "From a shared watch." }),
        " Check it, then save. Blips go to your topic.",
      ]),
    ]),
    { role: "note" },
  );
}

export function offPageLine(host: string): string {
  return `For ${host}. Open that page to check it.`;
}

type PasteOptions = {
  /** The popup gets a full screen with Back; the options page a dialog with Cancel. */
  inDialog: boolean;
  onBack: () => void;
  onContinue: (shared: SharedWatch) => void;
};

const PASTE_TITLE = "Paste a watch";

export function pasteScreen(options: PasteOptions): HTMLElement[] {
  const area = el("textarea", { className: "ta", id: "shared-watch", spellcheck: false });
  attrs(area, { autocomplete: "off", "aria-describedby": "shared-watch-note" });
  const problem = el("p", { className: "err-line", id: "shared-watch-error", hidden: true });
  const go = el("button", { type: "button", className: "btn primary grow", disabled: true });
  go.textContent = "Continue";
  let parsed: SharedWatch | null = null;
  area.addEventListener("input", () => {
    parsed = check(area, problem);
    go.disabled = parsed === null;
  });
  go.addEventListener("click", () => {
    if (parsed) options.onContinue(parsed);
  });
  const note = hint(
    options.inDialog
      ? "Nothing is saved until you check it and save."
      : "Paste what someone copied with Share. Nothing is saved until you check it and save.",
  );
  note.id = "shared-watch-note";
  const body = el("div", { className: "screen-bd" }, [
    el("div", { className: "field" }, [
      el("label", { className: "label", htmlFor: area.id, textContent: "Shared watch" }),
      area,
      problem,
      note,
    ]),
  ]);
  requestAnimationFrame(() => {
    area.focus();
  });
  return [pasteHeader(options), body, pasteFooter(options, go)];
}

/** An empty box is not an error yet; anything else either parses or says why not. */
function check(area: HTMLTextAreaElement, problem: HTMLElement): SharedWatch | null {
  const text = area.value;
  const result = text.trim() === "" ? null : parseShare(text);
  const error = result && "error" in result ? result.error : null;
  problem.textContent = error ?? "";
  problem.hidden = error === null;
  area.classList.toggle("bad", error !== null);
  area.setAttribute("aria-invalid", String(error !== null));
  return result && "shared" in result ? result.shared : null;
}

function pasteHeader(options: PasteOptions): HTMLElement {
  if (!options.inDialog) return screenHeader(PASTE_TITLE, options.onBack);
  return el("header", { className: "dialog-hd" }, [
    el("h2", { className: "brand", textContent: PASTE_TITLE }),
  ]);
}

function pasteFooter(options: PasteOptions, go: HTMLButtonElement): HTMLElement {
  if (!options.inDialog) return el("div", { className: "foot" }, [go]);
  const cancel = el("button", {
    type: "button",
    className: "btn secondary",
    textContent: "Cancel",
  });
  cancel.addEventListener("click", options.onBack);
  return el("div", { className: "foot" }, [cancel, go]);
}
