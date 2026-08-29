import { describe, expect, it } from "vitest";

import { COOLDOWN_MS, inCooldown, shouldRetry } from "./cooldown.js";

describe("inCooldown", () => {
  it("holds until the window has fully passed", () => {
    expect(inCooldown(1_000, 1_000 + COOLDOWN_MS - 1)).toBe(true);
    expect(inCooldown(1_000, 1_000 + COOLDOWN_MS)).toBe(false);
  });

  it("lets a watch that has never fired through", () => {
    expect(inCooldown(undefined, Date.now())).toBe(false);
  });
});

describe("shouldRetry", () => {
  it("gives transport trouble exactly one more go", () => {
    expect(shouldRetry(1, true)).toBe(true);
    expect(shouldRetry(2, true)).toBe(false);
    expect(shouldRetry(1, false)).toBe(false);
  });
});
