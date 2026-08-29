import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Watch } from "../core/watch.js";

const mocks = vi.hoisted(() => ({
  patchWatch: vi.fn<(id: string, patch: Record<string, unknown>) => Promise<null>>(),
  publish: vi.fn<() => Promise<{ ok: true }>>(),
}));

vi.mock("../storage.js", () => ({ patchWatch: mocks.patchWatch }));
vi.mock("../core/publish.js", () => ({ publish: mocks.publish }));

const { fire } = await import("./blip.js");

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

const patches = () => mocks.patchWatch.mock.calls.map(([, patch]) => patch);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.patchWatch.mockResolvedValue(null);
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
});
