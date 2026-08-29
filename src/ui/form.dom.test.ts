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
import { draftFrom, fillForm, readForm } from "./form.js";

const parked: WatchDraft = {
  urlPattern: "https://example.com/tickets*",
  selector: ".ticket-row .buy-button",
  condition: "gone",
  topic: "@alice/tickets",
  server: "https://blipr.dev",
  token: "blipr_pk_secret",
  title: "Build done",
  message: "{matches} left on {url}",
  priority: 4,
  once: false,
  cooldownSeconds: 30,
  refresh: true,
  refreshMinutes: 15,
};

const pages = ["../popup/popup.html", "../options/options.html"];

describe.each(pages)("%s", (page) => {
  it("carries every field of a parked draft back out unchanged", () => {
    document.body.innerHTML = readFileSync(new URL(page, import.meta.url), "utf8");
    const form = document.querySelector("form#watch-form");
    if (!(form instanceof HTMLFormElement)) throw new Error(`${page} has no watch form.`);

    fillForm(form, parked);
    expect(draftFrom(readForm(form))).toEqual(parked);
  });
});
