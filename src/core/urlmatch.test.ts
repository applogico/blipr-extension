import { describe, expect, it } from "vitest";

import { matchesUrl, suggestPattern } from "./urlmatch.js";

describe("matchesUrl", () => {
  it("matches the whole URL, not a prefix", () => {
    expect(matchesUrl("https://ci.example.com/run", "https://ci.example.com/run")).toBe(true);
    expect(matchesUrl("https://ci.example.com/run", "https://ci.example.com/run/42")).toBe(false);
  });

  it("treats * as the only wildcard", () => {
    expect(matchesUrl("https://ci.example.com/run*", "https://ci.example.com/run/42")).toBe(true);
    expect(matchesUrl("https://ci.example.com/*/logs", "https://ci.example.com/42/logs")).toBe(
      true,
    );
  });

  it("does not let regex characters in a URL become a pattern", () => {
    expect(matchesUrl("https://example.com/a+b", "https://example.com/aaab")).toBe(false);
    expect(matchesUrl("https://example.com/a+b", "https://example.com/a+b")).toBe(true);
  });
});

describe("suggestPattern", () => {
  it("offers the page without its query or hash", () => {
    expect(suggestPattern("https://ci.example.com/run/42?tab=logs#step3")).toBe(
      "https://ci.example.com/run/42*",
    );
  });

  it("hands back anything it cannot parse", () => {
    expect(suggestPattern("about:blank")).toBe("about:blank");
  });
});
