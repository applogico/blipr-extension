import { describe, expect, it } from "vitest";

import type { SharedWatch } from "./share.js";
import {
  FROM_NEWER,
  MAX_SHARE_CHARS,
  NOT_A_SHARE,
  SHARE_LIMITS,
  TOO_LONG,
  badField,
  importedDraft,
  parseShare,
  shareWatch,
} from "./share.js";
import type { Watch, WatchDraft } from "./watch.js";
import { validate } from "./watch.js";

const watch: Watch = {
  id: "w-123",
  urlPattern: "https://example.com/builds/*",
  selector: ".status.done",
  containsText: "Passed",
  condition: "appears",
  topic: "@me/secret-topic",
  server: "https://private.example.net",
  priority: 4,
  once: false,
  enabled: true,
  title: "Build {matches}",
  message: "See {url}",
  refresh: true,
  refreshMinutes: 5,
  cooldownSeconds: 60,
  watchingSince: 1_700_000_000_000,
  lastFiredAt: 1_700_000_100_000,
  lastSuppressedAt: 1_700_000_200_000,
  lastRefreshedAt: 1_700_000_300_000,
  lastError: "Selector broke",
  lastErrorAt: 1_700_000_400_000,
};

const base: WatchDraft = {
  urlPattern: "https://mine.example.org/*",
  selector: "",
  condition: "appears",
  topic: "my-topic",
  server: "https://blipr.dev",
  priority: 3,
  once: true,
  cooldownSeconds: 10,
};

function shared(text: string): SharedWatch {
  const parsed = parseShare(text);
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.shared;
}

function error(text: string): string | undefined {
  const parsed = parseShare(text);
  return "error" in parsed ? parsed.error : undefined;
}

function share(extra: Record<string, unknown>): string {
  return JSON.stringify({
    blipr: "watch",
    version: 1,
    urlPattern: "https://example.com/*",
    selector: ".x",
    blipWhen: "gone",
    ...extra,
  });
}

describe("shareWatch", () => {
  it("writes readable, pretty-printed JSON with a marker and a version", () => {
    const text = shareWatch(watch);
    expect(text).toContain('\n  "blipr": "watch"');
    expect(JSON.parse(text)).toEqual({
      blipr: "watch",
      version: 1,
      urlPattern: "https://example.com/builds/*",
      selector: ".status.done",
      textContains: "Passed",
      blipWhen: "appears",
      priority: 4,
      blipEveryTime: true,
      cooldownSeconds: 60,
      reloadEveryMinutes: 5,
      title: "Build {matches}",
      message: "See {url}",
    });
  });

  it("never carries the server, topic, id, state, timestamps or errors", () => {
    const text = shareWatch(watch);
    for (const leaked of [
      "w-123",
      "secret-topic",
      "private.example.net",
      "1700000",
      "Selector broke",
    ]) {
      expect(text).not.toContain(leaked);
    }
    const keys = Object.keys(JSON.parse(text) as object);
    for (const key of ["id", "topic", "server", "enabled", "watchingSince", "lastError"]) {
      expect(keys).not.toContain(key);
    }
  });

  it("ignores fields it does not know, even ones added to a watch later", () => {
    const future = { ...watch, apiToken: "blipr_pk_secret", topicOverride: "@x/y" } as Watch;
    expect(shareWatch(future)).not.toMatch(/blipr_pk_|topicOverride|@x\/y/);
  });

  it("leaves out empty optional fields and a reload that is switched off", () => {
    const plain = JSON.parse(
      shareWatch({ ...watch, containsText: "", title: "", message: "", refresh: false }),
    ) as object;
    expect(Object.keys(plain)).toEqual([
      "blipr",
      "version",
      "urlPattern",
      "selector",
      "blipWhen",
      "priority",
      "blipEveryTime",
      "cooldownSeconds",
    ]);
  });

  it("is never encoded", () => {
    expect(shareWatch(watch)).toContain(".status.done");
  });
});

describe("parseShare, round trip", () => {
  it("reads back everything it wrote", () => {
    expect(shared(shareWatch(watch))).toEqual({
      urlPattern: watch.urlPattern,
      selector: watch.selector,
      containsText: "Passed",
      condition: "appears",
      priority: 4,
      once: false,
      cooldownSeconds: 60,
      refreshMinutes: 5,
      title: "Build {matches}",
      message: "See {url}",
    });
  });

  it("becomes a draft for the importer's own server and topic, ready for validation", () => {
    const draft = importedDraft(base, shared(shareWatch(watch)));
    expect(draft).toEqual({
      urlPattern: watch.urlPattern,
      selector: watch.selector,
      containsText: "Passed",
      condition: "appears",
      topic: "my-topic",
      server: "https://blipr.dev",
      priority: 4,
      once: false,
      cooldownSeconds: 60,
      refresh: true,
      refreshMinutes: 5,
      title: "Build {matches}",
      message: "See {url}",
    });
    expect(draft.id).toBeUndefined();
    expect(validate(draft)).toEqual([]);
  });

  it("falls back to the importer's defaults for what the share leaves out", () => {
    const draft = importedDraft({ ...base, refresh: true, refreshMinutes: 9 }, shared(share({})));
    expect(draft).toEqual({
      urlPattern: "https://example.com/*",
      selector: ".x",
      condition: "gone",
      topic: "my-topic",
      server: "https://blipr.dev",
      priority: 3,
      once: true,
      cooldownSeconds: 10,
    });
  });
});

describe("parseShare, wrapping", () => {
  const text = shareWatch(watch);

  it("accepts surrounding whitespace", () => {
    expect(shared(`\n\n   ${text}  \n\t`).selector).toBe(".status.done");
  });

  it("accepts a Slack code fence, with or without a language", () => {
    expect(shared("```\n" + text + "\n```").selector).toBe(".status.done");
    expect(shared("```json\n" + text + "\n```").selector).toBe(".status.done");
    expect(shared("```" + text + "```").selector).toBe(".status.done");
    expect(shared("  ```\r\n" + text + "\r\n```  ").selector).toBe(".status.done");
  });

  it("accepts inline backticks", () => {
    expect(shared("`" + share({}) + "`").selector).toBe(".x");
  });
});

describe("parseShare, refusals", () => {
  it("refuses what is not JSON", () => {
    for (const bad of ["", "   ", "hello", "{", "{'blipr': 'watch'}", "```\n{\n```"]) {
      expect(error(bad)).toBe(NOT_A_SHARE);
    }
  });

  it("refuses JSON that is not an object", () => {
    for (const bad of ["null", "42", '"watch"', "[]", '[{"blipr":"watch","version":1}]']) {
      expect(error(bad)).toBe(NOT_A_SHARE);
    }
  });

  it("refuses a wrong or missing marker", () => {
    expect(error(share({ blipr: "topic" }))).toBe(NOT_A_SHARE);
    expect(error(share({ blipr: undefined }))).toBe(NOT_A_SHARE);
    expect(error(share({ blipr: true }))).toBe(NOT_A_SHARE);
  });

  it("refuses a missing or nonsense version, and says so for a newer one", () => {
    for (const version of [undefined, 0, -1, 1.5, "1", null]) {
      expect(error(share({ version }))).toBe(NOT_A_SHARE);
    }
    expect(error(share({ version: 2 }))).toBe(FROM_NEWER);
  });

  it("refuses input too long to be a share", () => {
    expect(error(" ".repeat(MAX_SHARE_CHARS + 1))).toBe(TOO_LONG);
  });

  it("insists on a URL pattern, a selector and a condition", () => {
    expect(error(share({ urlPattern: undefined }))).toBe(badField("URL pattern"));
    expect(error(share({ selector: "  " }))).toBe(badField("element"));
    expect(error(share({ blipWhen: undefined }))).toBe(badField("condition"));
  });
});

describe("parseShare, field checks", () => {
  it("holds the URL pattern to the editor's own check", () => {
    for (const urlPattern of [
      "example.com",
      "javascript:alert(1)",
      "file:///etc/*",
      "https://*x/",
    ]) {
      expect(error(share({ urlPattern }))).toBe(badField("URL pattern"));
    }
    expect(shared(share({ urlPattern: "*://*.example.com/*" })).urlPattern).toBe(
      "*://*.example.com/*",
    );
  });

  it("checks the type of every field", () => {
    const cases: Array<[string, unknown, string]> = [
      ["urlPattern", 42, "URL pattern"],
      ["selector", [".x"], "element"],
      ["textContains", 7, "text to match"],
      ["blipWhen", "sometimes", "condition"],
      ["priority", "4", "priority"],
      ["blipEveryTime", "yes", "every time setting"],
      ["cooldownSeconds", "60", "cooldown"],
      ["reloadEveryMinutes", true, "reload time"],
      ["title", { text: "x" }, "title"],
      ["message", null, "message"],
    ];
    for (const [key, value, what] of cases) {
      expect(error(share({ [key]: value }))).toBe(badField(what));
    }
  });

  it("keeps numbers in the editor's ranges", () => {
    expect(error(share({ priority: 6 }))).toBe(badField("priority"));
    expect(error(share({ priority: 2.5 }))).toBe(badField("priority"));
    expect(error(share({ cooldownSeconds: 5 }))).toBe(badField("cooldown"));
    expect(error(share({ cooldownSeconds: 3601 }))).toBe(badField("cooldown"));
    expect(error(share({ reloadEveryMinutes: 0 }))).toBe(badField("reload time"));
    expect(error(share({ reloadEveryMinutes: 1441 }))).toBe(badField("reload time"));
  });

  it("caps the length of every text field", () => {
    const over = (n: number) => "a".repeat(n + 1);
    expect(error(share({ selector: over(SHARE_LIMITS.selector) }))).toBe(badField("element"));
    expect(error(share({ textContains: over(SHARE_LIMITS.containsText) }))).toBe(
      badField("text to match"),
    );
    expect(error(share({ title: over(SHARE_LIMITS.title) }))).toBe(badField("title"));
    expect(error(share({ message: over(SHARE_LIMITS.message) }))).toBe(badField("message"));
    const longUrl = `https://example.com/${over(SHARE_LIMITS.urlPattern)}`;
    expect(error(share({ urlPattern: longUrl }))).toBe(badField("URL pattern"));
    expect(shared(share({ title: "a".repeat(SHARE_LIMITS.title) })).title).toHaveLength(
      SHARE_LIMITS.title,
    );
  });

  it("refuses control characters in text", () => {
    expect(error(share({ title: "line\nbreak" }))).toBe(badField("title"));
    expect(error(share({ selector: ".x\u0000" }))).toBe(badField("element"));
  });

  it("trims text and drops empty optional text", () => {
    const read = shared(
      share({ selector: "  .x  ", title: "   ", message: "", textContains: " " }),
    );
    expect(read).toEqual({
      urlPattern: "https://example.com/*",
      selector: ".x",
      condition: "gone",
    });
  });

  it("keeps the selector and text as plain data", () => {
    const selector = "img[onerror='alert(1)'] <script>";
    expect(shared(share({ selector, textContains: "${process.env}" }))).toMatchObject({
      selector,
      containsText: "${process.env}",
    });
  });
});

describe("parseShare, unknown fields", () => {
  it("drops anything it does not know, including server, topic and tokens", () => {
    const read = shared(
      share({
        server: "https://evil.example",
        topic: "@them/x",
        token: "blipr_pk_x",
        id: "w-1",
        enabled: true,
        lastFiredAt: 1,
        refresh: true,
        __proto__: { polluted: true },
        constructor: "x",
      }),
    );
    expect(read).toEqual({
      urlPattern: "https://example.com/*",
      selector: ".x",
      condition: "gone",
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const draft = importedDraft(base, read);
    expect(draft.server).toBe("https://blipr.dev");
    expect(draft.topic).toBe("my-topic");
  });

  it("does not pick up a pollution attempt written as raw JSON", () => {
    const raw =
      '{"blipr":"watch","version":1,"urlPattern":"https://e.com/*","selector":".x","blipWhen":"gone","__proto__":{"priority":5}}';
    expect(shared(raw).priority).toBeUndefined();
  });
});
