import { describe, expect, it } from "vitest";

import type { WatchDraft } from "./watch.js";
import { MAX_REFRESH_MINUTES, validate } from "./watch.js";

const draft: WatchDraft = {
  urlPattern: "https://example.com/*",
  selector: ".spinner",
  condition: "gone",
  topic: "ci",
  server: "https://blipr.dev",
  priority: 3,
  once: true,
};

describe("validate", () => {
  it("passes a watch with everything filled in", () => {
    expect(validate(draft)).toEqual([]);
  });

  it("reports every problem at once", () => {
    expect(validate({ ...draft, urlPattern: " ", selector: "", topic: "" })).toHaveLength(3);
  });

  it("insists on an http(s) server and a priority in range", () => {
    expect(validate({ ...draft, server: "ftp://blipr.dev" })).toContain(
      "The server must be an http(s) URL.",
    );
    expect(validate({ ...draft, priority: 6 })).toHaveLength(1);
    expect(validate({ ...draft, priority: 2.5 })).toHaveLength(1);
  });
});

describe("validate, refresh", () => {
  it("leaves a watch that does not refresh alone", () => {
    expect(validate(draft)).toEqual([]);
    expect(validate({ ...draft, refresh: false })).toEqual([]);
  });

  it("takes a whole number of minutes", () => {
    expect(validate({ ...draft, refresh: true, refreshMinutes: 1 })).toEqual([]);
    expect(validate({ ...draft, refresh: true, refreshMinutes: MAX_REFRESH_MINUTES })).toEqual([]);
  });

  it("refuses seconds, halves, and nonsense", () => {
    expect(validate({ ...draft, refresh: true, refreshMinutes: 0 })).toHaveLength(1);
    expect(validate({ ...draft, refresh: true, refreshMinutes: 0.5 })).toHaveLength(1);
    expect(validate({ ...draft, refresh: true, refreshMinutes: Number.NaN })).toHaveLength(1);
    expect(
      validate({ ...draft, refresh: true, refreshMinutes: MAX_REFRESH_MINUTES + 1 }),
    ).toHaveLength(1);
  });

  it("will not switch refreshing on without an interval", () => {
    expect(validate({ ...draft, refresh: true })).toEqual([
      "Say how often to refresh the page, in minutes.",
    ]);
  });

  it("checks a stored interval even while refreshing is switched off", () => {
    expect(validate({ ...draft, refresh: false, refreshMinutes: 0 })).toHaveLength(1);
  });
});
