import type { Blip } from "./message.js";
import type { WatchDraft } from "./watch.js";

export type PublishOutcome = { ok: true } | { ok: false; retryable: boolean; message: string };

/** `@handle/leaf` is two path segments, so each is encoded on its own. */
export function publishUrl(server: string, topic: string): string {
  const path = topic.trim().split("/").map(encodeURIComponent).join("/");
  return `${server.replace(/\/+$/, "")}/api/notify/${path}`;
}

/**
 * One publish attempt. Every refusal is final — retrying a missing topic or a
 * bad token just burns requests — so only transport-level trouble is retryable.
 */
export async function publish(
  draft: WatchDraft,
  blip: Blip,
  fetchImpl: typeof fetch = fetch,
): Promise<PublishOutcome> {
  const body = { ...blip, priority: draft.priority };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (draft.token?.trim()) headers.Authorization = `Bearer ${draft.token.trim()}`;

  let response: Response;
  try {
    response = await fetchImpl(publishUrl(draft.server, draft.topic), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, retryable: true, message: "Could not reach the server." };
  }

  if (response.ok) return { ok: true };
  return { ok: false, ...explain(response.status) };
}

function explain(status: number): { retryable: boolean; message: string } {
  switch (status) {
    case 404:
      return {
        retryable: false,
        message: "That topic does not exist yet. Create it in the Blipr app first.",
      };
    case 401:
    case 403:
      return { retryable: false, message: "The server rejected that token." };
    case 402:
      return { retryable: false, message: "That topic hit its limit for today." };
    case 429:
      return { retryable: true, message: "Rate limited by the server." };
    default:
      return status >= 500
        ? { retryable: true, message: `The server failed (HTTP ${status}).` }
        : { retryable: false, message: `The server refused it (HTTP ${status}).` };
  }
}
