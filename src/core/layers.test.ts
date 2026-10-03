import { describe, expect, it } from "vitest";

import { firstUseful, isCover, stepLayer } from "./layers.js";

const card = { hasContent: true, area: 694 * 180 };
const cover = { hasContent: false, area: 694 * 180 };
const title = { hasContent: true, area: 600 * 24 };

describe("isCover", () => {
  it("is an empty layer as large as what it sits on", () => {
    expect(isCover(cover, card)).toBe(true);
  });

  it("is never a layer with content, a small layer, or the last layer", () => {
    expect(isCover(title, card)).toBe(false);
    expect(isCover({ hasContent: false, area: 10 }, card)).toBe(false);
    expect(isCover(cover, undefined)).toBe(false);
  });
});

describe("firstUseful", () => {
  it("skips a full-card link to the content beneath", () => {
    expect(firstUseful([cover, card])).toBe(1);
  });

  it("keeps the topmost layer when it has content", () => {
    expect(firstUseful([title, card])).toBe(0);
  });

  it("skips stacked covers, and falls back to the top when everything is empty", () => {
    expect(firstUseful([cover, cover, card])).toBe(2);
    expect(firstUseful([cover])).toBe(0);
    expect(firstUseful([])).toBe(0);
  });
});

describe("stepLayer", () => {
  it("wraps forwards and backwards", () => {
    expect(stepLayer(0, 3, false)).toBe(1);
    expect(stepLayer(2, 3, false)).toBe(0);
    expect(stepLayer(0, 3, true)).toBe(2);
    expect(stepLayer(0, 0, false)).toBe(0);
  });
});
