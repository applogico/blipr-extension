import { describe, expect, it, vi } from "vitest";

import { publish, publishUrl } from "./publish.js";
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

const responding = (status: number) =>
  vi.fn(() => Promise.resolve(new Response(null, { status }))) as unknown as typeof fetch;

const initOf = (fetchImpl: typeof fetch, index: number): RequestInit | undefined => {
  const call = vi.mocked(fetchImpl).mock.calls[index];
  if (!call) throw new Error(`fetch has no call ${index}`);
  return call[1];
};

describe("publishUrl", () => {
  it("encodes a protected topic as two segments", () => {
    expect(publishUrl(DEFAULT_SERVER, "@alice/tickets")).toBe(
      "https://blipr.dev/api/notify/%40alice/tickets",
    );
  });

  it("does not double the slash on a server with a trailing one", () => {
    expect(publishUrl("https://blipr.dev/", "ci")).toBe("https://blipr.dev/api/notify/ci");
  });
});

describe("publish", () => {
  it("sends the token only when there is one", async () => {
    const fetchImpl = responding(200);
    await publish(draft, blip, fetchImpl);
    const init = initOf(fetchImpl, 0);
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();

    await publish({ ...draft, token: " tok " }, blip, fetchImpl);
    const withToken = initOf(fetchImpl, 1);
    expect((withToken?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("sends the blip it is given, with the watch's priority", async () => {
    const fetchImpl = responding(200);
    await publish(draft, { title: "Blipr", message: "Test blip." }, fetchImpl);
    const init = initOf(fetchImpl, 0);
    expect(JSON.parse(init?.body as string)).toEqual({
      title: "Blipr",
      message: "Test blip.",
      priority: 3,
    });
  });

  it("never retries a refusal, and says what to do about a missing topic", async () => {
    const result = await publish(draft, blip, responding(404));
    expect(result).toEqual({
      ok: false,
      retryable: false,
      message: "That topic does not exist yet. Create it in the Blipr app first.",
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
});
