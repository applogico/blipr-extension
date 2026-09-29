import { describe, expect, it } from "vitest";

import type { Watch } from "../core/watch.js";
import { clockTime, matchPhrase, statusText, summaryLabel } from "./text.js";

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

  it("dates a failed send and says it is retrying while the blip waits", () => {
    const failedAt = now - 3 * 60_000;
    const unsent = {
      blip: { title: "t", message: "m" },
      firstFailedAt: failedAt,
      lastTriedAt: failedAt,
      attempts: 1,
    };
    const waiting = {
      ...watch,
      unsent,
      lastError: "Could not reach the server.",
      lastErrorAt: failedAt,
    };
    expect(statusText(waiting, now)).toBe(
      `Couldn't reach the server at ${clockTime(failedAt)}. Retrying.`,
    );
  });

  it("says when it gave up on a blip", () => {
    const gaveUp = { ...watch, lastError: "Couldn't reach the server. Gave up after an hour." };
    expect(statusText(gaveUp, now)).toBe("Couldn't reach the server. Gave up after an hour.");
  });

  it("shows the time as hours and minutes only", () => {
    expect(clockTime(now)).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(clockTime(now)).toMatch(/\d{1,2}:\d{2}/);
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

  it("says a blip was skipped rather than leaving the user to wonder", () => {
    const skipped = { ...watch, lastFiredAt: now - 10_000, lastSuppressedAt: now - 5_000 };
    expect(statusText(skipped, now)).toBe("Blipped just now — Skipped a blip just now (cooldown)");
  });

  it("drops the skip notice once a later blip has gone out", () => {
    const recovered = { ...watch, lastSuppressedAt: now - 10 * 60_000, lastFiredAt: now };
    expect(statusText(recovered, now)).toBe("Blipped just now");
  });
});
