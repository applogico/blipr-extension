// The refresh switch a watch row carries, in the popup and on the options page
// alike. It only starts and stops the reloads: the interval, and the watch
// itself, are left exactly as they were.
import type { Watch } from "../core/watch.js";
import { patchWatch } from "../storage.js";
import type { RowAction } from "./list.js";
import { refreshLabel } from "./text.js";

/** Only the form sets an interval, so a watch without one has nothing to switch on. */
export const REFRESH_TOGGLE: RowAction = {
  action: "refresh",
  text: (watch) => (watch.refresh ? "Stop refreshing" : `Refresh ${refreshLabel(watch)}`),
  when: (watch) => watch.refreshMinutes !== undefined,
};

/** Switching on starts the clock now, so a stale watch does not reload the page instantly. */
export async function toggleRefresh(watch: Watch): Promise<void> {
  await patchWatch(
    watch.id,
    watch.refresh ? { refresh: false } : { refresh: true, lastRefreshedAt: Date.now() },
  );
}
