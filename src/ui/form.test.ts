import { describe, expect, it } from "vitest";

import type { WatchDraft } from "../core/watch.js";
import { DEFAULT_PRIORITY, DEFAULT_SERVER } from "../core/watch.js";
import { blankDraft, cleanDraft, shouldRememberTopic, withRefresh } from "./form.js";
import { stepValue } from "./stepper.js";

const draft: WatchDraft = {
  urlPattern: " https://example.com/* ",
  selector: " .spinner ",
  containsText: "  ",
  condition: "gone",
  topic: " ci ",
  server: " ",
  title: " Build done ",
  message: "",
  priority: 5,
  once: false,
  cooldownSeconds: 10,
};

describe("blankDraft", () => {
  it("starts from the defaults in Settings", () => {
    const blank = blankDraft({ topic: "ci", priority: 4, cooldownSeconds: 30 }, "https://x.dev/*");
    expect(blank).toMatchObject({ topic: "ci", priority: 4, cooldownSeconds: 30, once: true });
  });

  it("falls back to Blipr's own defaults, and lifts an old cooldown to the floor", () => {
    const blank = blankDraft({ cooldownSeconds: 5 }, "https://x.dev/*");
    expect(blank).toMatchObject({
      topic: "",
      server: DEFAULT_SERVER,
      priority: DEFAULT_PRIORITY,
      cooldownSeconds: 10,
    });
  });
});

describe("cleanDraft", () => {
  it("trims, drops empty optional fields, and never saves a blank server", () => {
    expect(cleanDraft(draft)).toEqual({
      urlPattern: "https://example.com/*",
      selector: ".spinner",
      condition: "gone",
      topic: "ci",
      server: DEFAULT_SERVER,
      title: "Build done",
      priority: 5,
      once: false,
      cooldownSeconds: 10,
    });
  });
});

describe("withRefresh", () => {
  it("switches on at one minute, and keeps an interval set before", () => {
    expect(withRefresh(draft, true)).toMatchObject({ refresh: true, refreshMinutes: 1 });
    expect(withRefresh({ ...draft, refreshMinutes: 15 }, true).refreshMinutes).toBe(15);
  });

  it("keeps the interval when switched off, so switching back remembers it", () => {
    const off = withRefresh({ ...draft, refresh: true, refreshMinutes: 15 }, false);
    expect(off).not.toHaveProperty("refresh");
    expect(off.refreshMinutes).toBe(15);
  });
});

describe("stepValue", () => {
  const reload = { min: 1, max: 1440, step: 1 };
  const cooldown = { min: 10, max: 3600, step: 10 };

  it("steps by one minute and stops at both ends", () => {
    expect(stepValue(1, 1, reload)).toBe(2);
    expect(stepValue(1, -1, reload)).toBe(1);
    expect(stepValue(1440, 1, reload)).toBe(1440);
  });

  it("steps the cooldown by ten, never under ten seconds", () => {
    expect(stepValue(10, 1, cooldown)).toBe(20);
    expect(stepValue(10, -1, cooldown)).toBe(10);
    expect(stepValue(3600, 1, cooldown)).toBe(3600);
  });

  it("snaps an off-step value to the grid", () => {
    expect(stepValue(15, 1, cooldown)).toBe(20);
    expect(stepValue(15, -1, cooldown)).toBe(10);
    expect(stepValue(Number.NaN, 1, cooldown)).toBe(20);
  });
});

describe("shouldRememberTopic, the first-run default", () => {
  it("saves the topic when there is no default yet and the box is ticked", () => {
    expect(shouldRememberTopic({}, true, "alerts")).toBe(true);
  });

  it("leaves an existing default alone, and respects an unticked box", () => {
    expect(shouldRememberTopic({ topic: "tickets" }, true, "alerts")).toBe(false);
    expect(shouldRememberTopic({}, false, "alerts")).toBe(false);
    expect(shouldRememberTopic({}, true, "  ")).toBe(false);
  });
});
