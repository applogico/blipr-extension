import { describe, expect, it } from "vitest";

import { DEFAULT_PRIORITY, DEFAULT_SERVER } from "../core/watch.js";
import { blankDraft, draftFrom, valuesFrom } from "./form.js";

const values = {
  urlPattern: " https://example.com/* ",
  selector: " .spinner ",
  condition: "gone",
  topic: " ci ",
  server: " https://blipr.dev ",
  token: "  ",
  priority: "5",
  repeat: "every",
  refresh: "off",
  refreshMinutes: "",
};

describe("draftFrom", () => {
  it("trims what the user typed and reads the two selects as their meaning", () => {
    expect(draftFrom(values)).toEqual({
      urlPattern: "https://example.com/*",
      selector: ".spinner",
      condition: "gone",
      topic: "ci",
      server: "https://blipr.dev",
      priority: 5,
      once: false,
    });
  });

  it("leaves refresh out entirely when the page is not being reloaded", () => {
    expect(draftFrom(values)).not.toHaveProperty("refresh");
    expect(draftFrom(values)).not.toHaveProperty("refreshMinutes");
  });

  it("reads the refresh switch and its interval as a number of minutes", () => {
    const refreshing = draftFrom({ ...values, refresh: "on", refreshMinutes: " 15 " });
    expect(refreshing.refresh).toBe(true);
    expect(refreshing.refreshMinutes).toBe(15);
  });

  it("keeps an interval that is switched off, so switching it back on remembers it", () => {
    const paused = draftFrom({ ...values, refresh: "off", refreshMinutes: "15" });
    expect(paused).not.toHaveProperty("refresh");
    expect(paused.refreshMinutes).toBe(15);
  });

  it("leaves the token out entirely when the field is blank", () => {
    expect(draftFrom(values)).not.toHaveProperty("token");
    expect(draftFrom({ ...values, token: " tok " }).token).toBe("tok");
  });

  it("falls back rather than saving an empty server or a priority of NaN", () => {
    const bare = draftFrom({ ...values, server: "", priority: "" });
    expect(bare.server).toBe(DEFAULT_SERVER);
    expect(bare.priority).toBe(DEFAULT_PRIORITY);
  });
});

describe("valuesFrom", () => {
  it("round-trips a draft back through the controls", () => {
    const draft = draftFrom({ ...values, token: "tok" });
    expect(draftFrom(valuesFrom(draft))).toEqual(draft);
  });

  it("puts a fire-once watch on the 'once' option", () => {
    expect(valuesFrom(blankDraft({}, "https://example.com/*")).repeat).toBe("once");
  });

  it("round-trips a refreshing draft too", () => {
    const draft = draftFrom({ ...values, refresh: "on", refreshMinutes: "15" });
    expect(draftFrom(valuesFrom(draft))).toEqual(draft);
  });

  it("starts a new watch with refreshing off", () => {
    const blank = valuesFrom(blankDraft({}, "https://example.com/*"));
    expect(blank.refresh).toBe("off");
    expect(blank.refreshMinutes).toBe("");
  });
});
