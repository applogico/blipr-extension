import { describe, expect, it } from "vitest";

import { inCooldown, shouldRetry } from "./cooldown.js";

describe("inCooldown", () => {
  it("holds until the window has fully passed", () => {
    expect(inCooldown(1_000, 1_000 + 4_999, 5)).toBe(true);
    expect(inCooldown(1_000, 1_000 + 5_000, 5)).toBe(false);
  });

  it("lets every later transition through, however many there are", () => {
    const fired = 1_000;
    expect(inCooldown(fired, fired + 6_000, 5)).toBe(false);
    expect(inCooldown(fired + 6_000, fired + 12_000, 5)).toBe(false);
    expect(inCooldown(fired + 12_000, fired + 18_000, 5)).toBe(false);
  });

  it("is off entirely at zero, so nothing is ever held back", () => {
    expect(inCooldown(1_000, 1_000, 0)).toBe(false);
    expect(inCooldown(1_000, 1_001, 0)).toBe(false);
  });

  it("takes a long window when a watch asks for one", () => {
    expect(inCooldown(1_000, 1_000 + 59_000, 60)).toBe(true);
    expect(inCooldown(1_000, 1_000 + 60_000, 60)).toBe(false);
  });

  it("lets a watch that has never fired through", () => {
    expect(inCooldown(undefined, Date.now(), 5)).toBe(false);
  });
});

describe("shouldRetry", () => {
  it("gives transport trouble exactly one more go", () => {
    expect(shouldRetry(1, true)).toBe(true);
    expect(shouldRetry(2, true)).toBe(false);
    expect(shouldRetry(1, false)).toBe(false);
  });
});
