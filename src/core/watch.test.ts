import { describe, expect, it } from "vitest";

import type { WatchDraft } from "./watch.js";
import {
  MAX_COOLDOWN_SECONDS,
  MAX_REFRESH_MINUTES,
  MIN_COOLDOWN_SECONDS,
  clampCooldown,
  cooldownSecondsOf,
  migrateWatch,
  validate,
} from "./watch.js";

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

describe("validate, cooldown", () => {
  it("leaves a watch that never set one alone", () => {
    expect(validate(draft)).toEqual([]);
  });

  it("takes the ten second floor and the ceiling", () => {
    expect(MIN_COOLDOWN_SECONDS).toBe(10);
    expect(validate({ ...draft, cooldownSeconds: 10 })).toEqual([]);
    expect(validate({ ...draft, cooldownSeconds: MAX_COOLDOWN_SECONDS })).toEqual([]);
  });

  it("refuses anything under ten seconds, halves, nonsense, and more than the ceiling", () => {
    expect(validate({ ...draft, cooldownSeconds: 0 })).toHaveLength(1);
    expect(validate({ ...draft, cooldownSeconds: 5 })).toHaveLength(1);
    expect(validate({ ...draft, cooldownSeconds: 10.5 })).toHaveLength(1);
    expect(validate({ ...draft, cooldownSeconds: Number.NaN })).toHaveLength(1);
    expect(validate({ ...draft, cooldownSeconds: MAX_COOLDOWN_SECONDS + 1 })).toHaveLength(1);
  });
});

describe("cooldown floor", () => {
  it("lifts anything stored under ten seconds to ten", () => {
    expect(clampCooldown(0)).toBe(10);
    expect(clampCooldown(5)).toBe(10);
    expect(clampCooldown(undefined)).toBe(10);
    expect(clampCooldown(Number.NaN)).toBe(10);
  });

  it("keeps a longer cooldown and caps one past the ceiling", () => {
    expect(clampCooldown(90)).toBe(90);
    expect(clampCooldown(MAX_COOLDOWN_SECONDS + 5)).toBe(MAX_COOLDOWN_SECONDS);
  });

  it("holds a watch with no cooldown to the floor", () => {
    expect(cooldownSecondsOf({})).toBe(10);
    expect(cooldownSecondsOf({ cooldownSeconds: 0 })).toBe(10);
  });

  it("migrates a stored watch, and leaves one that is already fine as it was", () => {
    expect(migrateWatch({ ...draft, cooldownSeconds: 5 }).cooldownSeconds).toBe(10);
    const fine = { ...draft, cooldownSeconds: 30 };
    expect(migrateWatch(fine)).toBe(fine);
    expect(migrateWatch(draft)).toBe(draft);
  });
});
