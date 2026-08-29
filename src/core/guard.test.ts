import { describe, expect, it, vi } from "vitest";

import { onceAtATime } from "./guard.js";

const deferred = () => {
  let settle!: () => void;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

describe("onceAtATime", () => {
  it("drops a second run started before the first has finished", async () => {
    const gate = deferred();
    const task = vi.fn(() => gate.promise);
    const guard = onceAtATime(task);

    const first = guard.run();
    const second = guard.run();
    expect(task).toHaveBeenCalledTimes(1);

    gate.settle();
    await Promise.all([first, second]);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("drops every extra run, not just the second", async () => {
    const gate = deferred();
    const task = vi.fn(() => gate.promise);
    const guard = onceAtATime(task);

    const runs = [guard.run(), guard.run(), guard.run(), guard.run()];
    gate.settle();
    await Promise.all(runs);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs again once the first has finished", async () => {
    const task = vi.fn(() => Promise.resolve());
    const guard = onceAtATime(task);

    await guard.run();
    await guard.run();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("reports whether it is busy", async () => {
    const gate = deferred();
    const guard = onceAtATime(() => gate.promise);
    expect(guard.busy).toBe(false);

    const running = guard.run();
    expect(guard.busy).toBe(true);

    gate.settle();
    await running;
    expect(guard.busy).toBe(false);
  });

  it("releases after a failure, so the user can try again", async () => {
    const task = vi.fn(() => Promise.reject(new Error("nope")));
    const guard = onceAtATime(task);

    await expect(guard.run()).rejects.toThrow("nope");
    expect(guard.busy).toBe(false);

    await expect(guard.run()).rejects.toThrow("nope");
    expect(task).toHaveBeenCalledTimes(2);
  });
});
