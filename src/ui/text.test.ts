import { describe, expect, it } from "vitest";

import type { Watch } from "../core/watch.js";
import { matchPhrase, statusText, summaryLabel } from "./text.js";

const watch: Watch = {
  id: "w1",
  urlPattern: "https://example.com/*",
  selector: ".spinner",
  condition: "gone",
  topic: "ci",
  server: "https://blipr.dev",
  priority: 3,
  once: true,
  enabled: true,
};

describe("matchPhrase", () => {
  it("counts in words, and singular is not '1 elements'", () => {
    expect(matchPhrase(1)).toBe("Matches 1 element right now.");
    expect(matchPhrase(3)).toBe("Matches 3 elements right now.");
    expect(matchPhrase(0)).toBe("Nothing matches right now.");
  });
});

describe("summaryLabel", () => {
  it("says what the watch does in one line", () => {
    expect(summaryLabel(watch)).toBe("is gone · p3 · once");
    expect(summaryLabel({ ...watch, condition: "appears", once: false, priority: 5 })).toBe(
      "appears · p5 · every time",
    );
  });

  it("says how often it reloads the page, but only while it is doing it", () => {
    expect(summaryLabel({ ...watch, refresh: true, refreshMinutes: 15 })).toBe(
      "is gone · p3 · once · refresh every 15 min",
    );
    expect(summaryLabel({ ...watch, refreshMinutes: 15 })).toBe("is gone · p3 · once");
  });
});

describe("statusText", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  it("leads with the error, not the last blip", () => {
    const failed = { ...watch, lastFiredAt: now - 60_000, lastError: "Rate limited." };
    expect(statusText(failed, now)).toBe("Rate limited.");
  });

  it("says a disabled watch is disabled, alongside why it stopped", () => {
    expect(statusText({ ...watch, enabled: false }, now)).toBe("Disabled — Waiting");
    expect(statusText({ ...watch, enabled: false, lastFiredAt: now }, now)).toBe(
      "Disabled — Blipped just now",
    );
  });

  it("is waiting until it has fired", () => {
    expect(statusText(watch, now)).toBe("Waiting");
    expect(statusText({ ...watch, lastFiredAt: now - 5 * 60_000 }, now)).toBe("Blipped 5 min ago");
  });
});
