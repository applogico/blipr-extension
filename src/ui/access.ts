// Host access is optional, and both engines only grant it from a user gesture,
// so this runs inside the click that saves a watch. `permissions.request`
// resolves true without a prompt when the origin is already granted, so it is
// the first thing awaited: anything before it would spend the gesture.
import browser from "webextension-polyfill";

import { hostOf, originPattern } from "../core/origins.js";

export type Access = { origin: string } | { error: string };

export async function requestAccess(urlPattern: string): Promise<Access> {
  const origin = originPattern(urlPattern);
  if (!origin) {
    return {
      error:
        "Blipr cannot tell which site that pattern covers. Give it a host and a path, like https://example.com/*.",
    };
  }
  const granted = await browser.permissions.request({ origins: [origin] }).catch(() => false);
  if (granted) return { origin };
  return { error: `Blipr needs access to ${hostOf(origin)} to watch it. Nothing was saved.` };
}
