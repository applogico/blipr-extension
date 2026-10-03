import { describe, expect, it } from "vitest";

import { CHECK_STALE_MS, healthUrl, isStale, nextCheck } from "./connection.js";

describe("healthUrl", () => {
  it("asks the health route on the scope a publish uses", () => {
    expect(healthUrl("https://blipr.dev")).toBe("https://blipr.dev/blip/health-check");
    expect(healthUrl(" https://blipr.dev// ")).toBe("https://blipr.dev/blip/health-check");
  });
});

describe("nextCheck", () => {
  it("remembers when the server last answered, through a failure", () => {
    const ok = nextCheck(null, "https://blipr.dev", true, 100);
    expect(ok).toEqual({ server: "https://blipr.dev", ok: true, at: 100, lastOkAt: 100 });
    expect(nextCheck(ok, "https://blipr.dev", false, 200)).toEqual({
      server: "https://blipr.dev",
      ok: false,
      at: 200,
      lastOkAt: 100,
    });
  });

  it("forgets the last answer of a different server", () => {
    const ok = nextCheck(null, "https://a.example", true, 100);
    expect(nextCheck(ok, "https://b.example", false, 200)).not.toHaveProperty("lastOkAt");
  });
});

describe("isStale", () => {
  const check = { server: "https://blipr.dev", ok: true, at: 0 };
  it("asks again when there is no answer, a different server, or an old one", () => {
    expect(isStale(null, "https://blipr.dev", 0)).toBe(true);
    expect(isStale(check, "https://other.example", 0)).toBe(true);
    expect(isStale(check, "https://blipr.dev", CHECK_STALE_MS + 1)).toBe(true);
    expect(isStale(check, "https://blipr.dev", 1_000)).toBe(false);
  });
});
