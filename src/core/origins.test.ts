import { describe, expect, it } from "vitest";

import { hostOf, originPattern } from "./origins.js";

describe("originPattern", () => {
  it("asks for the site, not the page", () => {
    expect(originPattern("https://ci.example.com/run/42*")).toBe("https://ci.example.com/*");
  });

  it("keeps the scheme it was given, and passes a subdomain wildcard through", () => {
    expect(originPattern("http://example.com/*")).toBe("http://example.com/*");
    expect(originPattern("https://*.example.com/*")).toBe("https://*.example.com/*");
    expect(originPattern("*://example.com/*")).toBe("*://example.com/*");
  });

  it("drops a port, which a match pattern cannot carry", () => {
    expect(originPattern("http://localhost:5173/app*")).toBe("http://localhost/*");
  });

  it("refuses a pattern whose host it cannot pin down", () => {
    expect(originPattern("https://example.com*")).toBeNull();
    expect(originPattern("https://ex*ple.com/*")).toBeNull();
    expect(originPattern("file:///tmp/page.html")).toBeNull();
    expect(originPattern("not a url")).toBeNull();
  });
});

describe("hostOf", () => {
  it("names the site a pattern covers", () => {
    expect(hostOf("https://ci.example.com/*")).toBe("ci.example.com");
    expect(hostOf("*://*.example.com/*")).toBe("*.example.com");
  });
});
