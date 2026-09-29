import { BliprClient, BliprError } from "@blipr/js";
import type { Priority } from "@blipr/js";

import type { Blip } from "./message.js";
import type { WatchDraft } from "./watch.js";

export type PublishOutcome = { ok: true } | { ok: false; retryable: boolean; message: string };

type Verdict = { retryable: boolean; message: string };

// Statuses worth wording ourselves, because the fix is on this side of the
// wire. Retrying a missing topic or a spent allowance only burns requests.
const BY_STATUS: Record<number, Verdict> = {
  402: { retryable: false, message: "That topic hit its limit for today." },
  404: {
    retryable: false,
    message: "That topic does not exist yet. Create it in the Blipr app first.",
  },
  429: { retryable: true, message: "Rate limited by the server." },
};

/** Names the failure so a row says what stopped the request, not just that it stopped. */
function unreachable(cause: unknown): Verdict {
  const reason = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  // Absent under Node, where the tests run; the worker always has it.
  const state = (globalThis as { navigator?: { onLine?: unknown } }).navigator?.onLine;
  const online = typeof state === "boolean" ? String(state) : "unknown";
  return { retryable: true, message: `Could not reach the server (${reason}; online ${online}).` };
}

/** Whether a failed publish is worth another attempt, and what to show for it. */
function classify(error: unknown): Verdict {
  if (!(error instanceof BliprError)) return unreachable(error);
  if (error.status === undefined) {
    // The SDK carries a `cause` only when the request never left the machine.
    // Without one it refused the call itself — a topic it cannot address, or a
    // blip with nothing in it — and no retry changes that.
    return error.cause === undefined
      ? { retryable: false, message: error.message }
      : unreachable(error.cause);
  }
  // Anything unlisted keeps the SDK's message, which carries the server's reason.
  return BY_STATUS[error.status] ?? { retryable: error.status >= 500, message: error.message };
}

/** One publish attempt. */
export async function publish(
  draft: WatchDraft,
  blip: Blip,
  fetchImpl: typeof fetch = fetch,
): Promise<PublishOutcome> {
  const client = new BliprClient({ server: draft.server, fetch: fetchImpl });
  try {
    await client.publish(draft.topic.trim(), blip.message, {
      title: blip.title,
      // The form only saves a whole 1–5; the SDK types that range as a union.
      priority: draft.priority as Priority,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, ...classify(error) };
  }
}
