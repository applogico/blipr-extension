import { describe, expect, it } from "vitest";

import { isDue, tickMinutes } from "./refresh.js";
import type { Refreshing } from "./refresh.js";

const every5: Refreshing = { enabled: true, refresh: true, refreshMinutes: 5 };
const MINUTE = 60_000;

describe("isDue", () => {
  it("waits out the whole interval", () => {
    const watch = { ...every5, lastRefreshedAt: 0 };
    expect(isDue(watch, 5 * MINUTE - 1)).toBe(false);
    expect(isDue(watch, 5 * MINUTE)).toBe(true);
  });

  it("is due when it has never been refreshed", () => {
    expect(isDue(every5, Date.now())).toBe(true);
  });

  it("leaves a watch alone when refreshing is switched off", () => {
    expect(isDue({ ...every5, refresh: false }, Date.now())).toBe(false);
  });

  it("leaves a watch alone when it is disabled, which a spent fire-once watch is", () => {
    expect(isDue({ ...every5, enabled: false }, Date.now())).toBe(false);
  });

  it("needs an interval, not just the switch", () => {
    expect(isDue({ enabled: true, refresh: true }, Date.now())).toBe(false);
  });
});

describe("tickMinutes", () => {
  it("ticks as often as the most frequent watch wants", () => {
    expect(tickMinutes([{ ...every5 }, { ...every5, refreshMinutes: 2 }])).toBe(2);
  });

  it("counts only the watches that are actually refreshing", () => {
    expect(tickMinutes([{ ...every5, refreshMinutes: 2, enabled: false }, every5])).toBe(5);
  });

  it("asks for no alarm at all when nothing refreshes", () => {
    expect(tickMinutes([{ ...every5, refresh: false }])).toBe(null);
    expect(tickMinutes([])).toBe(null);
  });
});
