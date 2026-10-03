import { describe, expect, it } from "vitest";

import type { Watch } from "../core/watch.js";
import {
  displayUrl,
  groupBySite,
  isOpen,
  isWatchableUrl,
  openableUrl,
  pagesSummary,
  siteOf,
  wholeSitePattern,
} from "./sites.js";

const watch: Watch = {
  id: "w1",
  urlPattern: "https://tickets.example.com/events/*",
  selector: ".buy-button",
  condition: "appears",
  topic: "tickets",
  server: "https://blipr.dev",
  priority: 4,
  once: true,
  enabled: true,
};

describe("isWatchableUrl", () => {
  it("takes ordinary web pages", () => {
    expect(isWatchableUrl("https://tickets.example.com/events/1842")).toBe(true);
    expect(isWatchableUrl("http://localhost:3000/")).toBe(true);
  });

  it("refuses browser pages, saved files, the stores and PDFs", () => {
    expect(isWatchableUrl("chrome://settings")).toBe(false);
    expect(isWatchableUrl("about:newtab")).toBe(false);
    expect(isWatchableUrl("file:///Users/me/page.html")).toBe(false);
    expect(isWatchableUrl("https://chromewebstore.google.com/detail/x")).toBe(false);
    expect(isWatchableUrl("https://chrome.google.com/webstore/detail/x")).toBe(false);
    expect(isWatchableUrl("https://addons.mozilla.org/en-US/firefox/")).toBe(false);
    expect(isWatchableUrl("https://example.com/report.PDF")).toBe(false);
    expect(isWatchableUrl("")).toBe(false);
  });
});

describe("isOpen, the paused check", () => {
  it("is open when any tab matches the pattern", () => {
    expect(isOpen(watch.urlPattern, ["https://tickets.example.com/events/1842"])).toBe(true);
  });

  it("is paused when no tab matches, even one on the same site", () => {
    expect(isOpen(watch.urlPattern, [])).toBe(false);
    expect(isOpen(watch.urlPattern, ["https://tickets.example.com/account"])).toBe(false);
  });
});

describe("siteOf and groupBySite", () => {
  it("names the host a pattern covers", () => {
    expect(siteOf("https://tickets.example.com/events/*")).toBe("tickets.example.com");
    expect(siteOf("not a pattern")).toBe("not a pattern");
  });

  it("groups by site in the order sites first appear", () => {
    const shop = { ...watch, id: "w2", urlPattern: "https://shop.example.com/*" };
    const again = { ...watch, id: "w3" };
    const groups = groupBySite([watch, shop, again]);
    expect(groups.map((group) => group.site)).toEqual(["tickets.example.com", "shop.example.com"]);
    expect(groups[0]?.watches.map((each) => each.id)).toEqual(["w1", "w3"]);
  });
});

describe("openableUrl", () => {
  it("opens the address before the first wildcard", () => {
    expect(openableUrl("https://shop.example.com/deals*")).toBe("https://shop.example.com/deals");
    expect(openableUrl("https://shop.example.com/*")).toBe("https://shop.example.com/");
  });

  it("falls back to the bare host for a wildcard host", () => {
    expect(openableUrl("*://*.example.com/*")).toBe("https://example.com/");
    expect(openableUrl("nonsense")).toBeNull();
  });
});

describe("displayUrl", () => {
  it("drops the scheme and the hash", () => {
    expect(displayUrl("https://tickets.example.com/events/1842#seats")).toBe(
      "tickets.example.com/events/1842",
    );
    expect(displayUrl("https://news.example.org/")).toBe("news.example.org");
  });
});

describe("pagesSummary", () => {
  const page = "https://tickets.example.com/events/1842?ref=x";
  it("says what the suggested and the whole-site patterns cover", () => {
    expect(pagesSummary("https://tickets.example.com/events/1842*", page)).toBe(
      "This page and anything under it.",
    );
    expect(pagesSummary("https://tickets.example.com/*", page)).toBe("Every page on this site.");
    expect(wholeSitePattern("https://tickets.example.com/events/*")).toBe(
      "https://tickets.example.com/*",
    );
  });

  it("falls back to describing the pattern itself", () => {
    expect(pagesSummary("https://tickets.example.com/events/*")).toBe(
      "Pages that start with this address.",
    );
    expect(pagesSummary("https://tickets.example.com/events/1")).toBe("Only this address.");
  });
});
