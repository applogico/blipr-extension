import { describe, expect, it } from "vitest";

import type { Watch } from "../core/watch.js";
import {
  ago,
  checkResultLine,
  checkingLine,
  connectionPill,
  errorCallout,
  errorWords,
  filteredLine,
  groupSummary,
  hereLine,
  lastBlipLabel,
  matchesOnPage,
  moreSummary,
  offlineCallout,
  optionsLine,
  otherLine,
  priorityLabel,
  savedToast,
  siteAccessLine,
  stateOf,
} from "./text.js";

const watch: Watch = {
  id: "w1",
  urlPattern: "https://tickets.example.com/*",
  selector: ".buy-button",
  condition: "appears",
  topic: "tickets",
  server: "https://blipr.dev",
  priority: 4,
  once: true,
  enabled: true,
};

// Local wall-clock times, so the clock strings hold in any time zone.
const now = new Date(2026, 9, 2, 14, 0).getTime();
const at = (hours: number, minutes: number, daysBack = 0) =>
  new Date(2026, 9, 2 - daysBack, hours, minutes).getTime();
const UNREACHABLE = "Could not reach the server (TypeError: Failed to fetch; online true).";
const text = (lines: Array<{ text: string }>) => lines.map((line) => line.text).join("");

describe("counts", () => {
  it("says how many elements match, singular and none included", () => {
    expect(matchesOnPage(3)).toBe("3 matches on this page");
    expect(matchesOnPage(1)).toBe("1 match on this page");
    expect(matchesOnPage(0)).toBe("No matches on this page");
  });

  it("says how many matches have the filter text", () => {
    expect(filteredLine(1, 3)).toBe("1 of 3 matches has this text");
    expect(filteredLine(2, 3)).toBe("2 of 3 matches have this text");
    expect(filteredLine(0, 3)).toBe("None of the 3 matches has this text");
  });
});

describe("ago and lastBlipLabel", () => {
  it("reads like a person would say it", () => {
    expect(ago(now - 20_000, now)).toBe("just now");
    expect(ago(now - 12 * 60_000, now)).toBe("12 min ago");
    expect(ago(at(9, 5), now)).toBe("at 09:05");
    expect(ago(at(18, 2, 1), now)).toBe("yesterday 18:02");
    expect(ago(at(12, 0, 3), now)).toBe("3 days ago");
  });

  it("starts the table column with a capital, and says Not yet before any blip", () => {
    expect(lastBlipLabel(watch, now)).toBe("Not yet");
    expect(lastBlipLabel({ lastFiredAt: at(18, 2, 1) }, now)).toBe("Yesterday 18:02");
  });
});

describe("state sentences", () => {
  it("puts an unreachable server in words, with the time", () => {
    expect(errorWords({ lastError: UNREACHABLE, lastErrorAt: at(13, 41) })).toBe(
      "Couldn't reach the server at 13:41",
    );
    expect(errorWords({ lastError: "That topic hit its limit for today." })).toBe(
      "That topic hit its limit for today.",
    );
  });

  it("orders states: off, then error, then paused", () => {
    expect(stateOf({ ...watch, enabled: false, lastError: "x" }, false)).toBe("off");
    expect(stateOf({ ...watch, lastError: "x" }, false)).toBe("error");
    expect(stateOf(watch, false)).toBe("paused");
    expect(stateOf(watch, true)).toBe("running");
  });

  it("says what a watch on this page is doing", () => {
    expect(hereLine(watch, now)).toEqual({ text: "When it appears. Nothing yet.", tone: "plain" });
    expect(hereLine({ ...watch, condition: "gone", lastFiredAt: now - 5 * 60_000 }, now).text).toBe(
      "When it's gone. Last blip 5 min ago.",
    );
    expect(hereLine({ ...watch, lastError: UNREACHABLE, lastErrorAt: at(13, 41) }, now)).toEqual({
      text: "Couldn't reach the server at 13:41",
      tone: "bad",
    });
  });

  it("says where another watch is and what it is doing", () => {
    const site = "ci.example.dev";
    expect(otherLine({ ...watch, lastFiredAt: now - 12 * 60_000 }, site, true, now).text).toBe(
      "ci.example.dev. Running, last blip 12 min ago.",
    );
    expect(otherLine(watch, site, true, now).text).toBe("ci.example.dev. Running.");
    expect(otherLine(watch, site, false, now)).toEqual({
      text: "ci.example.dev. Paused, no tab open.",
      tone: "warn",
    });
    expect(otherLine({ ...watch, enabled: false }, site, false, now).text).toBe(
      "ci.example.dev. Off.",
    );
  });

  it("says the options row's version, paused until the page is open", () => {
    expect(optionsLine({ ...watch, refresh: true, refreshMinutes: 1 }, true).text).toBe(
      "When it appears, once. Reloads every minute.",
    );
    expect(optionsLine(watch, false)).toEqual({
      text: "Paused until the page is open.",
      tone: "warn",
    });
  });
});

describe("groupSummary, the closed Other watches line", () => {
  it("counts each state, with paused and errors toned", () => {
    const lines = groupSummary(["running", "paused"]);
    expect(text(lines)).toBe("2 more: 1 running, 1 paused");
    expect(lines.find((line) => line.text === "1 paused")?.tone).toBe("warn");
    const failing = groupSummary(["running", "error", "error"]);
    expect(text(failing)).toBe("3 more: 1 running, 2 with errors");
    expect(failing.find((line) => line.text === "2 with errors")?.tone).toBe("bad");
  });

  it("says both, all, or the one when they agree", () => {
    expect(text(groupSummary(["running", "running"]))).toBe("2 more, both running");
    expect(text(groupSummary(["off", "off", "off"]))).toBe("3 more, all off");
    expect(text(groupSummary(["paused"]))).toBe("1 more, paused");
    expect(groupSummary(["paused"])[0]?.tone).toBe("warn");
  });
});

describe("the form's summaries", () => {
  it("summarises More options in one line", () => {
    expect(moreSummary({ priority: 4, once: true, refresh: true, refreshMinutes: 1 })).toBe(
      "High priority, blips once, reloads every minute",
    );
    expect(moreSummary({ priority: 3, once: true })).toBe("Default priority, blips once");
    expect(moreSummary({ priority: 5, once: false, refreshMinutes: 5 })).toBe(
      "Max priority, blips every time",
    );
  });

  it("names priorities the way the design does", () => {
    expect([1, 2, 3, 4, 5].map(priorityLabel)).toEqual(["Min", "Low", "Default", "High", "Max"]);
  });

  it("repeats the open-tab rule after a save", () => {
    expect(savedToast(".buy-button")).toBe("Watching .buy-button. Keep this tab open.");
  });
});

describe("connection", () => {
  const ok = { server: "https://blipr.dev", ok: true, at: at(13, 52), lastOkAt: at(13, 52) };
  const down = { server: "https://blipr.dev", ok: false, at: at(13, 55), lastOkAt: at(13, 41) };

  it("shows no pill until Blipr has asked, or after the server changed", () => {
    expect(connectionPill(null, "https://blipr.dev")).toBeNull();
    expect(connectionPill(ok, "https://other.example")).toBeNull();
    expect(connectionPill(ok, "https://blipr.dev")).toEqual({ text: "Connected", ok: true });
    expect(connectionPill(down, "https://blipr.dev")?.text).toBe("Not connected");
  });

  it("words the check result and the offline callout", () => {
    expect(checkResultLine(ok)).toBe("blipr.dev answered at 13:52");
    expect(checkResultLine(ok, true)).toBe("blipr.dev answered just now");
    expect(checkResultLine(down, true)).toBe("blipr.dev didn't answer just now");
    expect(checkingLine("https://blipr.dev")).toBe("Checking blipr.dev…");
    expect(offlineCallout(down)).toEqual({
      strong: "Blipr can't reach blipr.dev.",
      rest: "Watches keep watching, but blips can't be sent until the connection is back. Last answer at 13:41.",
    });
  });
});

describe("errorCallout", () => {
  it("is quiet when nothing is wrong", () => {
    expect(errorCallout([watch])).toBeNull();
  });

  it("names an unreachable server and points at Settings", () => {
    expect(errorCallout([watch, { ...watch, lastError: UNREACHABLE }])).toEqual({
      strong: "One watch couldn't reach the server.",
      rest: "Its row says when. Check your network, or the server in Settings.",
    });
  });

  it("counts other errors in general words", () => {
    const failing = { ...watch, lastError: "That topic hit its limit for today." };
    expect(errorCallout([failing, failing])?.strong).toBe("2 watches need attention.");
  });
});

describe("siteAccessLine", () => {
  it("says whether the site is open and what that means for its watches", () => {
    expect(siteAccessLine(true, 2).text).toBe("Open in a tab. 2 watches running.");
    expect(siteAccessLine(false, 1)).toEqual({
      text: "Not open in any tab. 1 watch paused.",
      tone: "warn",
    });
  });
});
