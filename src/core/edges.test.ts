import { describe, expect, it } from "vitest";

import { GRACE_MS, initialState, step } from "./edges.js";

const at = (ms: number) => ({ startedAt: 0, now: ms });

describe("appears", () => {
  it("fires on the first match and not again while it stays matched", () => {
    const state = initialState();
    let result = step("appears", state, { matches: 0, ...at(0) });
    expect(result.fire).toBe(false);

    result = step("appears", result.state, { matches: 3, ...at(10) });
    expect(result.fire).toBe(true);

    result = step("appears", result.state, { matches: 3, ...at(20) });
    expect(result.fire).toBe(false);
  });

  it("fires again after the match goes away and returns", () => {
    let { state } = step("appears", initialState(), { matches: 1, ...at(0) });
    ({ state } = step("appears", state, { matches: 0, ...at(10) }));
    expect(step("appears", state, { matches: 1, ...at(20) }).fire).toBe(true);
  });

  it("fires when the element is already there on arrival", () => {
    expect(step("appears", initialState(), { matches: 1, ...at(0) }).fire).toBe(true);
  });
});

describe("gone", () => {
  it("fires as soon as a match disappears, with no wait", () => {
    const { state } = step("gone", initialState(), { matches: 4, ...at(0) });
    expect(step("gone", state, { matches: 0, ...at(1) }).fire).toBe(true);
  });

  it("waits for the whole set to clear, not the first element", () => {
    let { state } = step("gone", initialState(), { matches: 7, ...at(0) });
    ({ state } = step("gone", state, { matches: 1, ...at(10) }));
    expect(step("gone", state, { matches: 1, ...at(20) }).fire).toBe(false);
    expect(step("gone", state, { matches: 0, ...at(30) }).fire).toBe(true);
  });

  it("stays quiet during the grace period when it never matched", () => {
    const { state, fire } = step("gone", initialState(), { matches: 0, ...at(GRACE_MS - 1) });
    expect(fire).toBe(false);
    expect(step("gone", state, { matches: 0, ...at(GRACE_MS) }).fire).toBe(true);
  });

  it("does not fire on a page that a refresh reloaded and is still rendering", () => {
    // The reload throws the page away, so the content script starts over: blank
    // state, fresh grace period, and no memory of what it matched before.
    const { state: before } = step("gone", initialState(), { matches: 2, ...at(0) });
    expect(before.seenMatch).toBe(true);

    const reloadedAt = 5 * 60_000;
    const blank = { matches: 0, startedAt: reloadedAt, now: reloadedAt + 10 };
    const { state, fire } = step("gone", initialState(), blank);
    expect(fire).toBe(false);
    expect(step("gone", state, { ...blank, now: reloadedAt + GRACE_MS }).fire).toBe(true);
  });
});
