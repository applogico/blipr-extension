import type { Condition } from "./watch.js";

/** What a page knows about one watch, for as long as that page is open. */
export type EdgeState = {
  /** The selector has matched at least once on this page. */
  seenMatch: boolean;
  /** The condition currently holds, so it must stop holding before firing again. */
  armed: boolean;
};

export const GRACE_MS = 5_000;

export function initialState(): EdgeState {
  return { seenMatch: false, armed: false };
}

/**
 * The state a watch starts in on a page that was already open when the watch
 * was saved. Whatever the condition says at that moment is what the user was
 * looking at when they created it, and a watch never fires for that: it starts
 * armed, so only a change from here on fires. A page a human just picked an
 * element on is settled, so "gone" does not wait out the grace period either.
 */
export function createdState(condition: Condition, matches: number): EdgeState {
  return { seenMatch: true, armed: holds(condition, matches, true) };
}

export type Observation = {
  matches: number;
  /** When the content script started watching this page. */
  startedAt: number;
  now: number;
};

/**
 * Fold one observation into the state, saying whether the watch should fire.
 *
 * "Gone" means the selector matches nothing, which is why a page of spinners
 * fires when the last one clears. It waits for the page to settle: either the
 * selector matched earlier — a real disappearance — or the grace period has
 * passed, which is the "it was never there" case.
 */
export function step(
  condition: Condition,
  state: EdgeState,
  { matches, startedAt, now }: Observation,
): { state: EdgeState; fire: boolean } {
  const seenMatch = state.seenMatch || matches > 0;
  const settled = seenMatch || now - startedAt >= GRACE_MS;
  const armed = holds(condition, matches, settled);

  return { state: { seenMatch, armed }, fire: armed && !state.armed };
}

function holds(condition: Condition, matches: number, settled: boolean): boolean {
  return condition === "appears" ? matches > 0 : matches === 0 && settled;
}
