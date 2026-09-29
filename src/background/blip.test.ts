import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RETRY_DELAY_MS } from "../core/cooldown.js";
import type { Blip, Occasion } from "../core/message.js";
import type { PublishOutcome } from "../core/publish.js";
import type { Unsent, Watch, WatchDraft } from "../core/watch.js";
import type { WatchPatch } from "../storage.js";

const mocks = vi.hoisted(() => ({
  patchWatch: vi.fn<(id: string, patch: WatchPatch) => Promise<null>>(),
  getWatch: vi.fn<(id: string) => Promise<Watch | null>>(),
  publish: vi.fn<(draft: WatchDraft, blip: Blip) => Promise<PublishOutcome>>(),
}));

vi.mock("../storage.js", () => ({ patchWatch: mocks.patchWatch, getWatch: mocks.getWatch }));
vi.mock("../core/publish.js", () => ({ publish: mocks.publish }));

const { GAVE_UP, fire, resend } = await import("./blip.js");

const watch: Watch = {
  id: "w1",
  urlPattern: "https://blipr.dev/*",
  selector: "html.dark",
  condition: "appears",
  topic: "ci",
  server: "https://blipr.dev",
  priority: 3,
  once: false,
  enabled: true,
};

const occasion = { matches: 1, url: "https://blipr.dev/" };

// The wording publish.ts settles on for each kind of refusal.
const MISSING_TOPIC = "That topic does not exist yet. Create it in the Blipr app first.";
const OVER_LIMIT = "That topic hit its limit for today.";
const RATE_LIMITED = "Rate limited by the server.";
const UNREACHABLE = "Could not reach the server.";
const FINAL_REASONS = [
  MISSING_TOPIC,
  OVER_LIMIT,
  'Publish to "ci" failed (HTTP 401).',
  'Publish to "ci" failed (HTTP 403).',
];

const failure = (message: string, retryable: boolean): PublishOutcome => ({
  ok: false,
  retryable,
  unreachable: message === UNREACHABLE,
  message,
});

const patches = () => mocks.patchWatch.mock.calls.map(([, patch]) => patch);

// What storage would hold for the watch `fire` was last handed.
let stored: Watch = watch;

/** Runs the watch and hands back what it looks like once `fire` is done with it. */
const fired = async (subject: Watch, at: Occasion = occasion): Promise<Watch> => {
  stored = { ...subject };
  await fire(subject, at);
  return stored;
};

const attemptOf = (index: number): [WatchDraft, Blip] => {
  const call = mocks.publish.mock.calls[index];
  if (!call) throw new Error(`publish has no call ${index}`);
  return call;
};

const blipOf = (index = 0): Blip => attemptOf(index)[1];

beforeEach(() => {
  vi.clearAllMocks();
  stored = { ...watch };
  mocks.patchWatch.mockImplementation((id, patch) => {
    if (id === stored.id) stored = { ...stored, ...patch } as Watch;
    return Promise.resolve(null);
  });
  mocks.getWatch.mockImplementation((id) => Promise.resolve(id === stored.id ? stored : null));
  mocks.publish.mockResolvedValue({ ok: true });
});

describe("fire", () => {
  it("blips a watch that has never fired", async () => {
    await fire(watch, occasion);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it("drops a blip inside the cooldown, and says so on the watch", async () => {
    await fire({ ...watch, cooldownSeconds: 5, lastFiredAt: Date.now() - 1_000 }, occasion);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(patches()).toEqual([{ lastSuppressedAt: expect.any(Number) as number }]);
  });

  it("blips the next transition once the window has passed", async () => {
    await fire({ ...watch, cooldownSeconds: 5, lastFiredAt: Date.now() - 6_000 }, occasion);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it("blips every transition when the cooldown is off", async () => {
    await fire({ ...watch, cooldownSeconds: 0, lastFiredAt: Date.now() }, occasion);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it("holds a watch saved before cooldowns existed to the default, not to a minute", async () => {
    await fire({ ...watch, lastFiredAt: Date.now() - 1_000 }, occasion);
    expect(mocks.publish).not.toHaveBeenCalled();

    await fire({ ...watch, lastFiredAt: Date.now() - 6_000 }, occasion);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it("stamps the fire and clears the error a failed one left behind", async () => {
    const after = await fired({ ...watch, lastError: UNREACHABLE });
    expect(after.lastFiredAt).toEqual(expect.any(Number));
    expect(after.lastError).toBeUndefined();
    expect(after.enabled).toBe(true);
  });

  it("sends to the watch's own topic, server and priority", async () => {
    await fired({ ...watch, topic: "deploys", server: "https://example.com", priority: 5 });
    expect(attemptOf(0)[0]).toMatchObject({
      topic: "deploys",
      server: "https://example.com",
      priority: 5,
    });
  });

  it("spends a fire-once watch on a blip that landed", async () => {
    expect(await fired({ ...watch, once: true })).toMatchObject({ enabled: false });
    expect((await fired({ ...watch, once: false })).enabled).toBe(true);
  });

  it("never blips a disabled watch, and leaves no mark on it", async () => {
    await fire({ ...watch, enabled: false }, occasion);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.patchWatch).not.toHaveBeenCalled();
  });

  it("never blips a fire-once watch that has already been spent", async () => {
    await fire({ ...watch, once: true, enabled: false, lastFiredAt: 1_000 }, occasion);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.patchWatch).not.toHaveBeenCalled();
  });
});

describe("fire, wording", () => {
  it("says Blipr's own wording when the watch has none", async () => {
    await fired(watch);
    expect(blipOf()).toEqual({ title: "It showed up", message: "html.dark appeared on the page." });

    mocks.publish.mockClear();
    await fired({ ...watch, condition: "gone", selector: ".spinner" });
    expect(blipOf()).toEqual({ title: "It's gone", message: ".spinner is no longer on the page." });
  });

  it("fills the watch's own wording from the page the condition was met on", async () => {
    await fired(
      { ...watch, title: "{matches} in stock", message: "{selector} on {url}" },
      { matches: 3, url: "https://shop.example/item/42" },
    );
    expect(blipOf()).toEqual({
      title: "3 in stock",
      message: "html.dark on https://shop.example/item/42",
    });
  });

  it("falls back one field at a time, so a custom title keeps the standard message", async () => {
    await fired({ ...watch, title: "Build done", message: "" });
    expect(blipOf()).toEqual({ title: "Build done", message: "html.dark appeared on the page." });
  });
});

describe("fire, when the publish fails", () => {
  it("never retries a refusal, and shows its reason on the watch", async () => {
    for (const reason of FINAL_REASONS) {
      mocks.publish.mockClear();
      mocks.publish.mockResolvedValue(failure(reason, false));
      expect(await fired(watch)).toMatchObject({ lastError: reason });
      expect(mocks.publish).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps the one shot of a fire-once watch that never delivered", async () => {
    mocks.publish.mockResolvedValue(failure(MISSING_TOPIC, false));
    expect(await fired({ ...watch, once: true })).toMatchObject({
      enabled: true,
      lastError: MISSING_TOPIC,
    });
  });
});

describe("fire, when the server is unreachable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives transport trouble one more go, two seconds later", async () => {
    mocks.publish.mockResolvedValue(failure(RATE_LIMITED, true));

    const running = fired(watch);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(await running).toMatchObject({ lastError: RATE_LIMITED, enabled: true });
    expect(mocks.publish).toHaveBeenCalledTimes(2);
  });

  it("blips on the retry, and leaves nothing behind about the attempt that failed", async () => {
    mocks.publish
      .mockResolvedValueOnce(failure(UNREACHABLE, true))
      .mockResolvedValueOnce({ ok: true });

    const running = fired({ ...watch, once: true, lastError: "older trouble" });
    await vi.runAllTimersAsync();
    const after = await running;

    expect(mocks.publish).toHaveBeenCalledTimes(2);
    expect(after.lastError).toBeUndefined();
    expect(after.enabled).toBe(false);
    expect(blipOf(1)).toEqual(blipOf(0));
  });
});

describe("fire, when the blip never leaves the machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const firedOffline = async (subject: Watch, at: Occasion = occasion): Promise<Watch> => {
    const running = fired(subject, at);
    await vi.runAllTimersAsync();
    return running;
  };

  it("keeps the blip on the watch to send again, and dates the error", async () => {
    mocks.publish.mockResolvedValue(failure(UNREACHABLE, true));
    const after = await firedOffline(watch);
    expect(after.unsent).toEqual({
      blip: blipOf(0),
      firstFailedAt: expect.any(Number) as number,
      lastTriedAt: expect.any(Number) as number,
      attempts: 0,
    });
    expect(after.lastError).toBe(UNREACHABLE);
    expect(after.lastErrorAt).toEqual(expect.any(Number));
  });

  it("keeps nothing when the server answered, even with an error", async () => {
    for (const reason of [RATE_LIMITED, MISSING_TOPIC]) {
      mocks.publish.mockResolvedValue(failure(reason, reason === RATE_LIMITED));
      const after = await firedOffline(watch);
      expect(after.unsent).toBeUndefined();
      expect(after).toMatchObject({ lastError: reason, lastErrorAt: expect.any(Number) as number });
    }
  });

  it("holds only the newest unsent blip", async () => {
    mocks.publish.mockResolvedValue(failure(UNREACHABLE, true));
    const older: Unsent = {
      blip: { title: "old", message: "old" },
      firstFailedAt: 1_000,
      lastTriedAt: 1_000,
      attempts: 3,
    };
    const after = await firedOffline({ ...watch, cooldownSeconds: 0, unsent: older });
    expect(after.unsent).toMatchObject({ blip: blipOf(0), attempts: 0 });
    expect(after.unsent?.firstFailedAt).toBeGreaterThan(older.firstFailedAt);
  });

  it("drops a waiting blip once a newer one lands", async () => {
    const older: Unsent = {
      blip: { title: "old", message: "old" },
      firstFailedAt: 1,
      lastTriedAt: 1,
      attempts: 1,
    };
    const after = await firedOffline({ ...watch, cooldownSeconds: 0, unsent: older });
    expect(after.unsent).toBeUndefined();
    expect(after.lastErrorAt).toBeUndefined();
  });
});

describe("resend", () => {
  const MINUTE = 60_000;
  const failedAt = Date.UTC(2026, 8, 16, 18, 41);
  const unsent: Unsent = {
    blip: { title: "It's gone", message: ".spinner is no longer on the page." },
    firstFailedAt: failedAt,
    lastTriedAt: failedAt,
    attempts: 0,
  };
  const waiting: Watch = {
    ...watch,
    unsent,
    lastError: UNREACHABLE,
    lastErrorAt: failedAt,
    lastFiredAt: failedAt,
  };

  const resent = async (subject: Watch, now: number): Promise<Watch> => {
    stored = { ...subject };
    await resend(subject, now);
    return stored;
  };

  it("sends the stored blip again and clears the error once it lands", async () => {
    const after = await resent(waiting, failedAt + MINUTE);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(blipOf(0)).toEqual(unsent.blip);
    expect(after.unsent).toBeUndefined();
    expect(after.lastError).toBeUndefined();
    expect(after.lastErrorAt).toBeUndefined();
  });

  it("spends a fire-once watch on a resend that landed", async () => {
    expect(await resent({ ...waiting, once: true }, failedAt + MINUTE)).toMatchObject({
      enabled: false,
    });
  });

  it("waits longer after every miss: 1, 2, 4, 8, then 15 minutes at most", async () => {
    const waits = [1, 2, 4, 8, 15, 15];
    for (const [attempts, minutes] of waits.entries()) {
      const subject = { ...waiting, unsent: { ...unsent, attempts, firstFailedAt: failedAt } };
      mocks.publish.mockClear();
      await resent(subject, failedAt + minutes * MINUTE - 31_000);
      expect(mocks.publish).not.toHaveBeenCalled();
      await resent(subject, failedAt + minutes * MINUTE);
      expect(mocks.publish).toHaveBeenCalledTimes(1);
    }
  });

  it("counts a miss and says when it last tried", async () => {
    mocks.publish.mockResolvedValue(failure(UNREACHABLE, true));
    const now = failedAt + 2 * MINUTE;
    const after = await resent(waiting, now);
    expect(after.unsent).toEqual({ ...unsent, attempts: 1, lastTriedAt: now });
    expect(after).toMatchObject({ lastError: UNREACHABLE, lastErrorAt: now });
  });

  it("gives up after the seventh miss, and says so", async () => {
    mocks.publish.mockResolvedValue(failure(UNREACHABLE, true));
    const lastTry = failedAt + 45 * MINUTE;
    const now = lastTry + 15 * MINUTE;
    const after = await resent(
      { ...waiting, unsent: { ...unsent, attempts: 6, lastTriedAt: lastTry } },
      now,
    );
    expect(after.unsent).toBeUndefined();
    expect(after).toMatchObject({ lastError: GAVE_UP, lastErrorAt: now });
  });

  it("gives up without sending once the blip is past the hour", async () => {
    const now = failedAt + 65 * MINUTE;
    const after = await resent(waiting, now);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(after.unsent).toBeUndefined();
    expect(after).toMatchObject({ lastError: GAVE_UP, lastErrorAt: now });
  });

  it("stops resending once the server answers, and shows its reason", async () => {
    mocks.publish.mockResolvedValue(failure(MISSING_TOPIC, false));
    const after = await resent(waiting, failedAt + MINUTE);
    expect(after.unsent).toBeUndefined();
    expect(after.lastError).toBe(MISSING_TOPIC);
  });

  it("leaves a disabled watch alone", async () => {
    await resent({ ...waiting, enabled: false }, failedAt + MINUTE);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.patchWatch).not.toHaveBeenCalled();
  });

  it("never overwrites a newer blip that failed while the resend was in flight", async () => {
    const newer: Unsent = { ...unsent, firstFailedAt: failedAt + 30_000 };
    mocks.publish.mockImplementation(() => {
      stored = { ...stored, unsent: newer };
      return Promise.resolve({ ok: true });
    });
    const after = await resent(waiting, failedAt + MINUTE);
    expect(after.unsent).toEqual(newer);
  });
});
