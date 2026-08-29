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

const responding = (status: number) =>
  vi.fn(() => Promise.resolve(new Response(null, { status }))) as unknown as typeof fetch;

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
    await publish(draft, fetchImpl);
    const [, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();

    await publish({ ...draft, token: " tok " }, fetchImpl);
    const [, withToken] = vi.mocked(fetchImpl).mock.calls[1]!;
    expect((withToken?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("sends the blip it was given instead of the one derived from the watch", async () => {
    const fetchImpl = responding(200);
    await publish(draft, fetchImpl, { title: "Blipr", message: "Test blip." });
    const [, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({
      title: "Blipr",
      message: "Test blip.",
      priority: 3,
    });
  });

  it("never retries a refusal, and says what to do about a missing topic", async () => {
    const result = await publish(draft, responding(404));
    expect(result).toEqual({
      ok: false,
      retryable: false,
      message: "That topic does not exist yet. Create it in the Blipr app first.",
    });
  });

  it("retries only transport trouble", async () => {
    expect(await publish(draft, responding(500))).toMatchObject({ retryable: true });
    expect(await publish(draft, responding(429))).toMatchObject({ retryable: true });
    expect(await publish(draft, responding(400))).toMatchObject({ retryable: false });

    const offline = vi.fn(() =>
      Promise.reject(new TypeError("network")),
    ) as unknown as typeof fetch;
    expect(await publish(draft, offline)).toMatchObject({ retryable: true });
  });
});
