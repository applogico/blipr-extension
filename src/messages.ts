// The message protocol between popup, content script and background.
// Every message is one variant here, so an unhandled kind or a wrong payload
// is a compile error rather than a silent no-op at runtime.
import browser from "webextension-polyfill";

import type { Watch, WatchDraft } from "./core/watch.js";
import type { SelectorPick } from "./core/selector.js";

export type Message =
  /** Content script asks which watches apply to the page it is running on. */
  | { kind: "watchesForUrl"; url: string }
  /** Content script reports a matched set becoming non-empty or empty. */
  | { kind: "conditionMet"; watchId: string; matches: number; url: string }
  /** Content script gives up on a selector that will never parse. */
  | { kind: "watchError"; watchId: string; error: string }
  /** Popup arms the picker on a tab; the popup closes on the next page click. */
  | { kind: "armPicker"; tabId: number }
  /** Content script hands back what the user clicked. */
  | { kind: "pickResult"; tabId: number; pick: SelectorPick }
  /** Popup reads and clears the pick stashed for its tab. */
  | { kind: "takePick"; tabId: number }
  /** Popup or options counts what a selector matches on a tab right now. */
  | { kind: "countMatches"; tabId: number; selector: string; containsText: string }
  /** Save a watch, requesting host access for its origin first. */
  | { kind: "saveWatch"; draft: WatchDraft }
  /** Publish once, without touching the watch's cooldown or fire-once state. */
  | { kind: "testWatch"; draft: WatchDraft };

export type Responses = {
  watchesForUrl: Array<
    Pick<Watch, "id" | "selector" | "containsText" | "condition" | "watchingSince">
  >;
  conditionMet: undefined;
  watchError: undefined;
  armPicker: undefined;
  pickResult: undefined;
  takePick: SelectorPick | null;
  countMatches: { matches: number } | { error: string };
  saveWatch: { saved: Watch } | { error: string };
  testWatch: { ok: true } | { error: string };
};

type OfKind<K extends Message["kind"]> = Extract<Message, { kind: K }>;

export function send<K extends Message["kind"]>(message: OfKind<K>): Promise<Responses[K]> {
  return browser.runtime.sendMessage(message);
}

export function sendToTab<K extends Message["kind"]>(
  tabId: number,
  message: OfKind<K>,
): Promise<Responses[K]> {
  return browser.tabs.sendMessage(tabId, message);
}

export type Handlers = {
  [K in Message["kind"]]?: (
    message: OfKind<K>,
    sender: browser.Runtime.MessageSender,
  ) => Responses[K] | Promise<Responses[K]>;
};

/** Dispatch to `handlers`; anything unhandled is ignored, not guessed at. */
export function onMessage(handlers: Handlers): void {
  browser.runtime.onMessage.addListener((raw: unknown, sender: browser.Runtime.MessageSender) => {
    const message = raw as Message;
    const handler = handlers[message.kind] as
      ((m: Message, s: browser.Runtime.MessageSender) => unknown) | undefined;
    return handler ? Promise.resolve(handler(message, sender)) : undefined;
  });
}
