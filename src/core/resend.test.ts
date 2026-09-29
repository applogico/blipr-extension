import { describe, expect, it } from "vitest";

import { MAX_RESENDS, isResending, isSpent, resendStep, waitMinutes } from "./resend.js";
import type { Unsent } from "./watch.js";

const MINUTE = 60_000;
const unsent: Unsent = {
  blip: { title: "t", message: "m" },
  firstFailedAt: 0,
  lastTriedAt: 0,
  attempts: 0,
};

describe("waitMinutes", () => {
  it("doubles after every miss, up to a quarter of an hour", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(waitMinutes)).toEqual([1, 2, 4, 8, 15, 15, 15]);
  });
});

describe("resendStep", () => {
  it("waits until the backoff has passed, allowing for a late or early alarm", () => {
    expect(resendStep(unsent, 29_000)).toBe("wait");
    expect(resendStep(unsent, 30_000)).toBe("send");
    const third = { ...unsent, attempts: 2, lastTriedAt: 3 * MINUTE };
    expect(resendStep(third, 6 * MINUTE)).toBe("wait");
    expect(resendStep(third, 7 * MINUTE)).toBe("send");
  });

  it("gives up once the blip is past the hour, however few tries it had", () => {
    expect(resendStep(unsent, 65 * MINUTE - 1)).toBe("send");
    expect(resendStep(unsent, 65 * MINUTE)).toBe("give up");
  });
});

describe("isSpent", () => {
  it("allows seven resends, the last about an hour in", () => {
    expect(isSpent({ ...unsent, attempts: MAX_RESENDS - 1 })).toBe(false);
    expect(isSpent({ ...unsent, attempts: MAX_RESENDS })).toBe(true);
    expect(MAX_RESENDS).toBe(7);
  });
});

describe("isResending", () => {
  it("only counts an enabled watch with a blip waiting", () => {
    expect(isResending({ enabled: true, unsent })).toBe(true);
    expect(isResending({ enabled: false, unsent })).toBe(false);
    expect(isResending({ enabled: true })).toBe(false);
  });
});
