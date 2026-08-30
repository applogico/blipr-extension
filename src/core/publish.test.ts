import { describe, expect, it, vi } from "vitest";

import { publish } from "./publish.js";
import { DEFAULT_SERVER } from "./watch.js";

const draft = {
  urlPattern: "https://example.com/*",
  selector: ".spinner",
  condition: "gone" as const,
  topic: "ci",
  server: DEFAULT_SERVER,
  priority: 3,
  once: false,
};

const blip = { title: "It's gone", message: ".spinner is no longer on the page." };

// The SDK reads the stored message back, so even a success needs a JSON body.
const responding = (status: number) =>
  vi.fn(() =>
    Promise.resolve(
      new Response(status === 200 ? JSON.stringify({ id: "m1", topic: "ci" }) : null, {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  ) as unknown as typeof fetch;

const callOf = (fetchImpl: typeof fetch, index: number) => {
  const call = vi.mocked(fetchImpl).mock.calls[index];
  if (!call) throw new Error(`fetch has no call ${index}`);
  const [target, init] = call;
  if (typeof target !== "string") throw new Error("the SDK passed a URL we cannot read");
  return { url: target, init };
};

const headersOf = (fetchImpl: typeof fetch, index: number) =>
  (callOf(fetchImpl, index).init?.headers ?? {}) as Record<string, string>;

describe("publish", () => {
  it("posts to the topic, with no double slash on a server that has one", async () => {
    const fetchImpl = responding(200);
    await publish(draft, blip, fetchImpl);
    expect(callOf(fetchImpl, 0).url).toBe("https://blipr.dev/blip/ci");

    await publish({ ...draft, server: "https://blipr.dev/" }, blip, fetchImpl);
    expect(callOf(fetchImpl, 1).url).toBe("https://blipr.dev/blip/ci");
  });

  it("sends the blip it is given, with the watch's priority", async () => {
    const fetchImpl = responding(200);
    await publish(draft, { title: "Blipr", message: "Test blip." }, fetchImpl);
    const { init } = callOf(fetchImpl, 0);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe("Test blip.");
    expect(headersOf(fetchImpl, 0)["X-Title"]).toBe("Blipr");
    expect(headersOf(fetchImpl, 0)["X-Priority"]).toBe("3");
  });

  it("never retries a refusal, and says what to do about a missing topic", async () => {
    const result = await publish(draft, blip, responding(404));
    expect(result).toEqual({
      ok: false,
      retryable: false,
      message: "That topic does not exist yet. Create it in the Blipr app first.",
    });
  });

  it("treats a refused publish and a spent allowance as final", async () => {
    for (const status of [401, 403]) {
      expect(await publish(draft, blip, responding(status))).toMatchObject({ retryable: false });
    }
    expect(await publish(draft, blip, responding(402))).toEqual({
      ok: false,
      retryable: false,
      message: "That topic hit its limit for today.",
    });
  });

  it("retries only transport trouble", async () => {
    expect(await publish(draft, blip, responding(500))).toMatchObject({ retryable: true });
    expect(await publish(draft, blip, responding(429))).toMatchObject({ retryable: true });
    expect(await publish(draft, blip, responding(400))).toMatchObject({ retryable: false });

    const offline = vi.fn(() =>
      Promise.reject(new TypeError("network")),
    ) as unknown as typeof fetch;
    expect(await publish(draft, blip, offline)).toMatchObject({ retryable: true });
  });

  it("refuses a topic it cannot address without sending anything", async () => {
    const fetchImpl = responding(200);
    const result = await publish({ ...draft, topic: "@alice/tickets" }, blip, fetchImpl);
    if (result.ok) throw new Error("expected the topic to be refused");
    expect(result.retryable).toBe(false);
    expect(result.message).toContain("@alice/tickets");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
