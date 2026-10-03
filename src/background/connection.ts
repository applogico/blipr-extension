import { CHECK_TIMEOUT_MS, healthUrl, nextCheck } from "../core/connection.js";
import type { ConnectionCheck } from "../storage.js";
import { getConnection, setConnection } from "../storage.js";

/** Any answer below 400 counts: the route has no body, only a status. */
export async function checkConnection(
  server: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionCheck> {
  const ok = await fetchImpl(healthUrl(server), {
    cache: "no-store",
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  }).then(
    (response) => response.ok,
    () => false,
  );
  const check = nextCheck(await getConnection(), server.trim(), ok, Date.now());
  await setConnection(check);
  return check;
}
