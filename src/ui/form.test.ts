import { describe, expect, it } from "vitest";

import { DEFAULT_COOLDOWN_SECONDS, DEFAULT_PRIORITY, DEFAULT_SERVER } from "../core/watch.js";
import { blankDraft, draftFrom, valuesFrom } from "./form.js";

const values = {
  urlPattern: " https://example.com/* ",
  selector: " .spinner ",
  condition: "gone",
  topic: " ci ",
  server: " https://blipr.dev ",
  title: "  ",
  message: "",
  priority: "5",
  repeat: "every",
  cooldownSeconds: "5",
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
      cooldownSeconds: 5,
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

  it("keeps custom wording only when there is some", () => {
    expect(draftFrom(values)).not.toHaveProperty("title");
    expect(draftFrom(values)).not.toHaveProperty("message");
    const worded = draftFrom({ ...values, title: " Build done ", message: "{matches} left" });
    expect(worded.title).toBe("Build done");
    expect(worded.message).toBe("{matches} left");
  });

  it("falls back rather than saving an empty server or a priority of NaN", () => {
    const bare = draftFrom({ ...values, server: "", priority: "" });
    expect(bare.server).toBe(DEFAULT_SERVER);
    expect(bare.priority).toBe(DEFAULT_PRIORITY);
  });
});

describe("draftFrom, cooldown", () => {
  it("reads a cleared box as no cooldown at all, not as the default", () => {
    expect(draftFrom({ ...values, cooldownSeconds: "" }).cooldownSeconds).toBe(0);
    expect(draftFrom({ ...values, cooldownSeconds: " 0 " }).cooldownSeconds).toBe(0);
  });

  it("keeps a longer window the user asked for", () => {
    expect(draftFrom({ ...values, cooldownSeconds: " 90 " }).cooldownSeconds).toBe(90);
  });

  it("falls back to the default rather than saving nonsense", () => {
    expect(draftFrom({ ...values, cooldownSeconds: "abc" }).cooldownSeconds).toBe(
      DEFAULT_COOLDOWN_SECONDS,
    );
  });
});

describe("valuesFrom", () => {
  it("round-trips a draft back through the controls", () => {
    const draft = draftFrom(values);
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

  it("starts a new watch on the default cooldown, not on a blank box", () => {
    expect(valuesFrom(blankDraft({}, "https://example.com/*")).cooldownSeconds).toBe(
      String(DEFAULT_COOLDOWN_SECONDS),
    );
  });

  it("shows a watch saved before cooldowns existed the default it is getting", () => {
    const legacy = draftFrom(values);
    delete legacy.cooldownSeconds;
    expect(valuesFrom(legacy).cooldownSeconds).toBe(String(DEFAULT_COOLDOWN_SECONDS));
  });
});
