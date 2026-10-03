// More options and Pages to watch: everything about a watch that the short
// form leaves out, each with a one-line summary back on the main screen.
import { messageFor } from "../core/message.js";
import { suggestPattern } from "../core/urlmatch.js";
import { PRIORITY_CHOICES, segmented, switchButton } from "./controls.js";
import { el } from "./dom.js";
import type { Editor } from "./editor.js";
import type { Screen } from "./editor-parts.js";
import { field, hidden, hint, screenHeader, switchRow, textInput } from "./editor-parts.js";
import { REFRESH_BOUNDS, withRefresh } from "./form.js";
import { openableUrl, pagesSummary, wholeSitePattern } from "./sites.js";
import { stepper } from "./stepper.js";
import { everyTimeLine, freshLine } from "./text.js";

export function moreScreen(editor: Editor, screen: Exclude<Screen, "main">): HTMLElement[] {
  return screen === "more" ? more(editor) : pages(editor);
}

function more(editor: Editor): HTMLElement[] {
  const back = () => {
    editor.open("main");
  };
  const body = el("div", { className: "screen-bd" }, [
    priorityField(editor),
    el("div", { className: "card rows" }, [
      everyTimeRow(editor),
      ...freshRows(editor),
      pagesRow(editor),
    ]),
    previewField(editor),
  ]);
  return [screenHeader("More options", back), body];
}

function priorityField(editor: Editor): HTMLElement {
  const fieldset = segmented({
    name: "priority",
    legend: "Priority",
    choices: PRIORITY_CHOICES,
    value: String(editor.draft.priority),
    onChange: (value) => {
      editor.update({ priority: Number(value) });
    },
    className: "pri5",
  });
  fieldset.append(hint("Max gets through Focus and needs Blipr Pro."));
  return fieldset;
}

function everyTimeRow(editor: Editor): HTMLElement {
  const line = el("span", { className: "sub", textContent: everyTimeLine(editor.draft.once) });
  const toggle = switchButton("Blip every time", !editor.draft.once, (on) => {
    editor.update({ once: !on });
    line.textContent = everyTimeLine(!on);
  });
  return switchRow("Blip every time", line, toggle);
}

function freshRows(editor: Editor): HTMLElement[] {
  const on = editor.draft.refresh === true;
  const line = el("span", { className: "sub", textContent: freshLine(on) });
  const nested = reloadRow(editor);
  nested.hidden = !on;
  const toggle = switchButton("Keep the tab fresh", on, (next) => {
    editor.replaceDraft(withRefresh(editor.draft, next));
    line.textContent = freshLine(next);
    nested.replaceWith(reloadRow(editor));
  });
  return [switchRow("Keep the tab fresh", line, toggle), nested];
}

function reloadRow(editor: Editor): HTMLElement {
  const minutes = editor.draft.refreshMinutes ?? REFRESH_BOUNDS.min;
  const unit = el("span", { className: "sub unit", textContent: unitOf(minutes) });
  const control = stepper({
    label: "Reload every",
    value: minutes,
    bounds: REFRESH_BOUNDS,
    onChange: (value) => {
      editor.update({ refreshMinutes: value });
      unit.textContent = unitOf(value);
    },
  });
  const row = el("div", { className: "row nested" }, [
    el("span", { className: "grow reload-label", textContent: "Reload every" }),
    control,
    unit,
  ]);
  row.hidden = editor.draft.refresh !== true;
  return row;
}

function unitOf(minutes: number): string {
  return minutes === 1 ? "minute" : "minutes";
}

function pagesRow(editor: Editor): HTMLElement {
  const button = el("button", { type: "button", className: "row-main" }, [
    el("span", { className: "grow" }, [
      el("span", { className: "t-strong", textContent: "Pages to watch" }),
      el("span", {
        className: "sub",
        textContent: pagesSummary(editor.draft.urlPattern, editor.ctx.pageUrl),
      }),
    ]),
    hidden(el("span", { className: "chev", textContent: "›" })),
  ]);
  button.addEventListener("click", () => {
    editor.open("pages");
  });
  return el("div", { className: "row" }, [button]);
}

function previewField(editor: Editor): HTMLElement {
  const preview = el("div", { className: "np-wrap" });
  const render = () => {
    preview.replaceChildren(notification(editor));
  };
  render();
  const wording = wordingFields(editor, render);
  const custom = Boolean(editor.draft.title ?? editor.draft.message);
  wording.hidden = !custom;
  const toggle = el("button", {
    type: "button",
    className: "link",
    textContent: "Edit title and message",
  });
  toggle.setAttribute("aria-expanded", String(custom));
  toggle.addEventListener("click", () => {
    wording.hidden = !wording.hidden;
    toggle.setAttribute("aria-expanded", String(!wording.hidden));
    if (!wording.hidden) wording.querySelector("input")?.focus();
  });
  return field([
    el("div", { className: "label-row" }, [
      el("span", { className: "label", textContent: "On your phone" }),
      toggle,
    ]),
    preview,
    wording,
  ]);
}

function notification(editor: Editor): HTMLElement {
  const { draft, ctx } = editor;
  const url = ctx.pageUrl ?? openableUrl(draft.urlPattern) ?? draft.urlPattern;
  const blip = messageFor(draft, { matches: editor.total ?? 1, url });
  const topic = draft.topic.trim();
  return el("div", { className: "np" }, [
    el("div", { className: "np-icon" }, [el("img", { src: ctx.markSrc, alt: "" })]),
    el("div", { className: "np-meta" }, [
      el("span", { textContent: topic ? `Blipr · ${topic}` : "Blipr" }),
      el("span", { textContent: "now" }),
    ]),
    el("div", { className: "np-title", textContent: blip.title }),
    el("div", { className: "np-body", textContent: blip.message }),
  ]);
}

function wordingFields(editor: Editor, render: () => void): HTMLElement {
  const title = textInput("title", editor.draft.title ?? "", (value) => {
    editor.update({ title: value });
    render();
  });
  const message = textInput("message", editor.draft.message ?? "", (value) => {
    editor.update({ message: value });
    render();
  });
  return el("div", { className: "wording" }, [
    labelled("Title", title),
    labelled("Message", message),
    hint(
      "Leave both empty for Blipr's own wording. {selector}, {matches} and {url} are filled in when the blip is sent.",
    ),
  ]);
}

function labelled(text: string, input: HTMLInputElement): HTMLElement {
  return field([
    el("label", { className: "label", htmlFor: input.id }, [
      `${text} `,
      el("span", { className: "opt-tag", textContent: "(optional)" }),
    ]),
    el("div", { className: "input" }, [input]),
  ]);
}

function pages(editor: Editor): HTMLElement[] {
  const input = textInput("urlPattern", editor.draft.urlPattern, (value) => {
    editor.update({ urlPattern: value });
  });
  input.spellcheck = false;
  const set = (pattern: string) => {
    input.value = pattern;
    editor.update({ urlPattern: pattern });
  };
  const body = el("div", { className: "screen-bd" }, [
    field([
      el("label", { className: "label", htmlFor: input.id, textContent: "URL pattern" }),
      el("div", { className: "input" }, [input]),
      hint("Matched against the whole URL. * is the only wildcard."),
    ]),
    shortcuts(editor, set),
    hint("Saving asks for access to that site, and Blipr only watches the sites you allow."),
  ]);
  return [
    screenHeader("Pages to watch", () => {
      editor.open("more");
    }),
    body,
  ];
}

function shortcuts(editor: Editor, set: (pattern: string) => void): HTMLElement {
  const { pageUrl } = editor.ctx;
  const options: Array<[string, string | null]> = [
    ["This page and anything under it", pageUrl ? suggestPattern(pageUrl) : null],
    ["Whole site", wholeSitePattern(pageUrl ?? editor.draft.urlPattern)],
  ];
  const buttons = options.flatMap(([label, pattern]) => {
    if (!pattern) return [];
    const button = el("button", { type: "button", className: "btn secondary", textContent: label });
    button.addEventListener("click", () => {
      set(pattern);
    });
    return [button];
  });
  return el("div", { className: "shortcuts" }, buttons);
}
