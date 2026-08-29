/**
 * @vitest-environment jsdom
 *
 * The popup closes under Chrome's permission prompt, so a half-filled watch is
 * parked and read back through the form. A field with no control on a page
 * would be dropped on the way back, silently, so both pages are checked.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { WatchDraft } from "../core/watch.js";
import { blankDraft, draftFrom, fillForm, readForm } from "./form.js";

const parked: WatchDraft = {
  urlPattern: "https://example.com/tickets*",
  selector: ".ticket-row .buy-button",
  containsText: "Sold out",
  condition: "gone",
  topic: "tickets",
  server: "https://blipr.dev",
  title: "Build done",
  message: "{matches} left on {url}",
  priority: 4,
  once: false,
  cooldownSeconds: 30,
  refresh: true,
  refreshMinutes: 15,
};

const pages = ["../popup/popup.html", "../options/options.html"];

const defaults = { topic: "ci", server: "https://blipr.dev", priority: 4 };

const load = (page: string): HTMLFormElement => {
  document.body.innerHTML = readFileSync(new URL(page, import.meta.url), "utf8");
  const form = document.querySelector("form#watch-form");
  if (!(form instanceof HTMLFormElement)) throw new Error(`${page} has no watch form.`);
  return form;
};

describe.each(pages)("%s", (page) => {
  it("carries every field of a parked draft back out unchanged", () => {
    const form = load(page);
    fillForm(form, parked);
    expect(draftFrom(readForm(form))).toEqual(parked);
  });

  it("resets to exactly what a fresh open would show", () => {
    const form = load(page);
    const fresh = blankDraft(defaults, "https://example.com/*");

    fillForm(form, parked);
    fillForm(form, fresh);
    expect(draftFrom(readForm(form))).toEqual(fresh);
  });

  it("keeps nothing of the watch just saved, and keeps the defaults", () => {
    const form = load(page);
    fillForm(form, parked);
    fillForm(form, blankDraft(defaults, "https://example.com/*"));
    const after = draftFrom(readForm(form));

    expect(after.selector).toBe("");
    expect(after).not.toHaveProperty("containsText");
    expect(after).not.toHaveProperty("title");
    expect(after).not.toHaveProperty("message");
    expect(after).not.toHaveProperty("refresh");
    expect(after).not.toHaveProperty("refreshMinutes");

    expect(after.urlPattern).toBe("https://example.com/*");
    expect(after.topic).toBe("ci");
    expect(after.server).toBe("https://blipr.dev");
    expect(after.priority).toBe(4);
  });
});
