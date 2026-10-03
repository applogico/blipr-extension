// The watch form, shared by the popup and the options page: the short main
// screen, More options, and Pages to watch. It keeps the draft in memory and
// only touches storage to save, delete, or remember a first topic.
import { onceAtATime } from "../core/guard.js";
import type { SelectorPick } from "../core/selector.js";
import type { Condition, Watch, WatchDraft } from "../core/watch.js";
import { validate } from "../core/watch.js";
import { send } from "../messages.js";
import type { WatchDefaults } from "../storage.js";
import { deleteWatch, rememberTopic } from "../storage.js";
import { requestAccess } from "./access.js";
import { attrs, el, listErrors, show } from "./dom.js";
import { cleanDraft, shouldRememberTopic } from "./form.js";
import { moreScreen } from "./editor-more.js";
import type { Field, Screen } from "./editor-parts.js";
import { field, screenHeader, serverLine, textInput } from "./editor-parts.js";
import { segmented } from "./controls.js";
import { filteredLine, matchesOnPage, moreSummary, plural } from "./text.js";

export type EditorContext = {
  /** The tab the popup was opened on; absent on the options page. */
  pageUrl?: string;
  /** Picking only works on the tab the popup belongs to, and only for its own watches. */
  pickable: boolean;
  markSrc: string;
  count?: (selector: string, containsText: string) => Promise<number | null>;
  onPickAgain?: (draft: WatchDraft) => void;
  onChange?: (draft: WatchDraft) => void;
  onBack: () => void;
  /** Opens Settings; the draft is already stashed by onChange, so nothing is lost. */
  onOpenSettings?: () => void;
  onSaved: (watch: Watch) => void;
  onDeleted: () => void;
};

export type EditorStart = {
  draft: WatchDraft;
  defaults: WatchDefaults;
  pick?: SelectorPick | null;
};

type PickChoice = { label: string; selector: string; small: string };

const COUNT_DELAY_MS = 250;

/**
 * Fades the top of the sticky footer while part of the form is hidden under it,
 * so a long form reads as scrollable. A sentinel at the end of the body tells.
 */
export function cueWhenMoreBelow(body: HTMLElement, footer: HTMLElement): void {
  const sentinel = el("div", { className: "end-sentinel" });
  body.append(sentinel);
  // Measured after layout, so the margin matches the footer that covers the end of the form.
  requestAnimationFrame(() => {
    const height = Math.ceil(footer.getBoundingClientRect().height);
    new IntersectionObserver(
      ([entry]) => {
        footer.classList.toggle("more-below", entry ? !entry.isIntersecting : false);
      },
      { rootMargin: `0px 0px -${height}px 0px` },
    ).observe(sentinel);
  });
}

export function mountEditor(root: HTMLElement, ctx: EditorContext, start: EditorStart): void {
  new Editor(root, ctx, start).open("main");
}

export class Editor {
  draft: WatchDraft;
  readonly defaults: WatchDefaults;
  readonly choices: PickChoice[];
  useAsDefault = true;
  total: number | null = null;
  filtered: number | null = null;
  private live: Partial<
    Record<"count" | "filter" | "suffix" | "summary" | "selector", HTMLElement>
  > = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deleteArmed = false;
  private readonly saving = onceAtATime(() => this.save());

  constructor(
    readonly root: HTMLElement,
    readonly ctx: EditorContext,
    start: EditorStart,
  ) {
    this.defaults = start.defaults;
    this.choices = choicesOf(start.pick ?? null);
    const preferred = this.choices.at(-1);
    this.draft = preferred ? { ...start.draft, selector: preferred.selector } : start.draft;
  }

  open(screen: Screen): void {
    const built = screen === "main" ? this.mainScreen() : moreScreen(this, screen);
    this.root.replaceChildren(...built);
    window.scrollTo(0, 0);
    this.root.querySelector<HTMLElement>(".screen-hd button")?.focus();
    if (screen === "main") this.recount(0);
  }

  update(patch: Partial<WatchDraft>): void {
    this.draft = { ...this.draft, ...patch };
    this.ctx.onChange?.(this.draft);
    this.refreshLive();
  }

  replaceDraft(draft: WatchDraft): void {
    this.draft = draft;
    this.ctx.onChange?.(draft);
  }

  private get editing(): boolean {
    return this.draft.id !== undefined;
  }

  private mainScreen(): HTMLElement[] {
    const body = el("div", { className: "screen-bd" }, [
      this.elementField(),
      this.conditionField(),
      this.topicField(),
      this.moreRow(),
      el("p", {
        className: "hint",
        textContent: "Blipr watches while this page is open in a tab. It can be in the background.",
      }),
      el("ul", { className: "errors", id: "form-errors", hidden: true }),
      attrs(el("p", { className: "result", id: "result", hidden: true }), {
        "aria-live": "polite",
      }),
      ...(this.editing ? [this.deleteButton()] : []),
    ]);
    const title = this.editing ? "Edit watch" : "New watch";
    const footer = this.footer();
    cueWhenMoreBelow(body, footer);
    return [
      screenHeader(title, () => {
        this.ctx.onBack();
      }),
      body,
      footer,
    ];
  }

  private elementField(): HTMLElement {
    const selector = textInput("selector", this.draft.selector, (value) => {
      this.update({ selector: value });
      this.recount();
    });
    selector.spellcheck = false;
    this.live.selector = selector;
    const count = attrs(el("p", { className: "count" }), { "aria-live": "polite" });
    this.live.count = count;
    const top = el("div", { className: "el-top" }, [
      el("div", { className: "grow" }, [selector, count]),
      ...(this.ctx.pickable ? [this.pickAgainButton()] : []),
    ]);
    const card = el("div", { className: "card el-card" }, [
      top,
      ...this.choiceRow(),
      this.filterBlock(),
    ]);
    return el("div", { className: "field" }, [
      el("label", { className: "label", htmlFor: selector.id, textContent: "Element" }),
      card,
    ]);
  }

  private pickAgainButton(): HTMLElement {
    const button = el("button", {
      type: "button",
      className: "btn ghost",
      textContent: "Pick again",
    });
    button.addEventListener("click", () => this.ctx.onPickAgain?.(this.draft));
    return button;
  }

  private choiceRow(): HTMLElement[] {
    if (this.choices.length < 2) return [];
    const fieldset = segmented({
      name: "which",
      legend: "Which elements",
      choices: this.choices.map(({ selector, label, small }) => ({
        value: selector,
        label,
        small,
      })),
      value: this.draft.selector,
      onChange: (value) => {
        if (this.live.selector instanceof HTMLInputElement) this.live.selector.value = value;
        this.update({ selector: value });
        this.recount(0);
      },
    });
    fieldset.querySelector("legend")?.classList.add("visually-hidden");
    return [el("div", { className: "el-choice" }, [fieldset])];
  }

  private filterBlock(): HTMLElement {
    const input = textInput("containsText", this.draft.containsText ?? "", (value) => {
      this.update({ containsText: value });
      this.recount();
    });
    input.placeholder = "Any text";
    const line = attrs(el("p", { className: "count", hidden: true }), { "aria-live": "polite" });
    this.live.filter = line;
    return el("div", { className: "el-filter" }, [
      el("label", { className: "label", htmlFor: input.id }, [
        "Only if its text contains ",
        el("span", { className: "opt-tag", textContent: "(optional)" }),
      ]),
      el("div", { className: "input" }, [input]),
      line,
    ]);
  }

  private conditionField(): HTMLElement {
    return segmented({
      name: "condition",
      legend: "Blip me when the element",
      choices: [
        { value: "appears", label: "Appears" },
        { value: "gone", label: "Is gone" },
      ],
      value: this.draft.condition,
      onChange: (value) => {
        this.update({ condition: value as Condition });
      },
    });
  }

  private topicField(): HTMLElement {
    const input = textInput("topic", this.draft.topic, (value) => {
      this.update({ topic: value });
    });
    input.autocomplete = "off";
    input.spellcheck = false;
    const suffix = el("span", { className: "suffix", textContent: "Your default" });
    this.live.suffix = suffix;
    const parts: Field[] = [
      el("label", { className: "label", htmlFor: input.id, textContent: "Send to topic" }),
      el("div", { className: "input" }, [input, suffix]),
    ];
    if (!this.defaults.topic) {
      parts.push(...this.firstTopicParts(), serverLine(this.draft.server, this.ctx.onOpenSettings));
    }
    return field(parts);
  }

  private firstTopicParts(): HTMLElement[] {
    const box = el("input", { type: "checkbox", checked: this.useAsDefault });
    box.addEventListener("change", () => {
      this.useAsDefault = box.checked;
    });
    return [
      el("p", { className: "hint", textContent: "Use a topic you created in the Blipr app." }),
      el("label", { className: "check" }, [box, "Use this topic for new watches"]),
    ];
  }

  private moreRow(): HTMLElement {
    const summary = el("span", { className: "sum" });
    this.live.summary = summary;
    const button = el("button", { type: "button", className: "more" }, [
      el("span", {}, ["More options", summary]),
      attrs(el("span", { className: "chev", textContent: "›" }), { "aria-hidden": "true" }),
    ]);
    button.addEventListener("click", () => {
      this.open("more");
    });
    return el("div", { className: "card" }, [button]);
  }

  private deleteButton(): HTMLElement {
    const button = el("button", { type: "button", className: "btn danger wide" }, ["Delete watch"]);
    button.addEventListener("click", () => {
      if (!this.deleteArmed) {
        this.deleteArmed = true;
        button.textContent = "Click again to delete";
        return;
      }
      void this.remove();
    });
    return button;
  }

  private footer(): HTMLElement {
    const test = el("button", {
      type: "button",
      className: "btn secondary",
      textContent: "Send test",
    });
    test.addEventListener("click", () => void this.test());
    const save = el("button", { type: "button", className: "btn primary grow", id: "save" }, [
      "Save watch",
    ]);
    save.addEventListener("click", () => {
      this.onSave();
    });
    return el("div", { className: "foot" }, [test, save]);
  }

  private refreshLive(): void {
    const { suffix, summary } = this.live;
    if (suffix)
      suffix.hidden = !this.defaults.topic || this.draft.topic.trim() !== this.defaults.topic;
    if (summary) summary.textContent = moreSummary(this.draft);
    this.renderCounts();
  }

  private recount(delay = COUNT_DELAY_MS): void {
    this.refreshLive();
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.count(), delay);
  }

  private async count(): Promise<void> {
    const { count } = this.ctx;
    const selector = this.draft.selector.trim();
    const text = this.draft.containsText?.trim() ?? "";
    if (!count || selector === "") {
      this.total = null;
      this.filtered = null;
    } else {
      [this.total, this.filtered] = await Promise.all([
        count(selector, ""),
        text ? count(selector, text) : Promise.resolve(null),
      ]);
    }
    this.renderCounts();
  }

  private renderCounts(): void {
    const { count, filter } = this.live;
    if (count) countLine(count, this.total === null ? null : matchesOnPage(this.total), this.total);
    if (filter) {
      const { total, filtered } = this;
      const shown = total !== null && filtered !== null && !!this.draft.containsText?.trim();
      countLine(filter, shown ? filteredLine(filtered, total) : null, filtered);
    }
  }

  private onSave(): void {
    if (this.saving.busy) return;
    const draft = cleanDraft(this.draft);
    const problems = validate(draft);
    this.errors(problems);
    if (problems.length > 0) return;
    this.replaceDraft(draft);
    // The gesture must reach `permissions.request`, so nothing is awaited before it.
    void this.saving.run();
  }

  private async save(): Promise<void> {
    const button = this.root.querySelector<HTMLButtonElement>("#save");
    if (button) {
      button.disabled = true;
      button.textContent = "Saving…";
    }
    try {
      await this.persist(this.draft);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Save watch";
      }
    }
  }

  private async persist(draft: WatchDraft): Promise<void> {
    const access = await requestAccess(draft.urlPattern);
    if ("error" in access) {
      this.result(access.error, "bad");
      return;
    }
    const outcome = await send({ kind: "saveWatch", draft });
    if ("error" in outcome) {
      this.result(outcome.error, "bad");
      return;
    }
    if (shouldRememberTopic(this.defaults, this.useAsDefault, draft.topic)) {
      await rememberTopic(draft);
    }
    this.ctx.onSaved(outcome.saved);
  }

  private async test(): Promise<void> {
    const draft = cleanDraft(this.draft);
    if (draft.topic === "") {
      this.result("Add a topic first.", "warn");
      return;
    }
    const outcome = await send({ kind: "testWatch", draft });
    if ("error" in outcome) this.result(outcome.error, "bad");
    else this.result("Test blip sent. Check your phone.", "good");
  }

  private async remove(): Promise<void> {
    if (this.draft.id === undefined) return;
    await deleteWatch(this.draft.id);
    this.ctx.onDeleted();
  }

  private errors(problems: string[]): void {
    const node = this.root.querySelector<HTMLElement>("#form-errors");
    if (node) listErrors(node, problems);
  }

  private result(text: string, tone: "good" | "bad" | "warn"): void {
    const node = this.root.querySelector<HTMLElement>("#result");
    if (node) show(node, text, tone);
  }
}

/** A count line hides when there is nothing to count, and turns amber at zero. */
function countLine(node: HTMLElement, text: string | null, value: number | null): void {
  node.hidden = text === null;
  node.textContent = text ?? "";
  node.className = value === 0 ? "count warn" : "count";
}

/** A pick offers the one element and everything like it, and starts on everything. */
function choicesOf(pick: SelectorPick | null): PickChoice[] {
  if (!pick) return [];
  const one = { label: "This element", selector: pick.unique, small: "1 match" };
  const similar = pick.similar;
  if (!similar || similar.selector === pick.unique) return [one];
  const small = plural(similar.matches, "match", "matches");
  return [one, { label: "All similar", selector: similar.selector, small }];
}
