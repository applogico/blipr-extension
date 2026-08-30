import { describe, expect, it } from "vitest";

import { countMatchingText, matchesText, normalizeText } from "./textmatch.js";

describe("normalizeText", () => {
  it("collapses the whitespace markup leaves behind", () => {
    expect(normalizeText("\n      Sold   out\n    ")).toBe("Sold out");
    expect(normalizeText("Sold\tout")).toBe("Sold out");
  });

  it("leaves text that is already tidy alone", () => {
    expect(normalizeText("Sold out")).toBe("Sold out");
    expect(normalizeText("")).toBe("");
  });
});

describe("matchesText", () => {
  it("passes everything when there is no filter", () => {
    expect(matchesText("anything at all", "")).toBe(true);
    expect(matchesText("", "")).toBe(true);
    expect(matchesText("anything", "   ")).toBe(true);
  });

  it("contains rather than equals, so surrounding words still match", () => {
    expect(matchesText("Sold out — back soon", "Sold out")).toBe(true);
    expect(matchesText("Sold out", "Sold out")).toBe(true);
  });

  it("ignores case on both sides", () => {
    expect(matchesText("SOLD OUT", "sold out")).toBe(true);
    expect(matchesText("sold out", "SOLD OUT")).toBe(true);
  });

  it("normalizes both sides, so one typed space matches markup's many", () => {
    expect(matchesText("\n  Sold\n  out\n", "Sold out")).toBe(true);
    expect(matchesText("Sold out", "  Sold   out  ")).toBe(true);
  });

  it("says no when the text is not there", () => {
    expect(matchesText("In stock", "Sold out")).toBe(false);
    expect(matchesText("", "Sold out")).toBe(false);
  });

  it("does not match across a gap the words do not actually share", () => {
    expect(matchesText("Sold something else out", "Sold out")).toBe(false);
  });
});

describe("countMatchingText", () => {
  it("counts every element when the filter is empty", () => {
    expect(countMatchingText(["a", "b", "c"], "")).toBe(3);
    expect(countMatchingText([], "")).toBe(0);
  });

  it("counts only the ones that contain the text", () => {
    expect(countMatchingText(["Sold out", "In stock", "sold out today"], "sold out")).toBe(2);
  });

  it("counts nothing when the filter matches nothing", () => {
    expect(countMatchingText(["In stock", "Available"], "Sold out")).toBe(0);
  });
});
