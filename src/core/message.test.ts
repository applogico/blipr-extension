import { describe, expect, it } from "vitest";

import { fill, messageFor } from "./message.js";
import type { Wording } from "./message.js";

const watch: Wording = { selector: ".spinner", condition: "gone" };
const occasion = { matches: 0, url: "https://example.com/ci/42" };
const facts = { selector: ".spinner", ...occasion };

describe("messageFor", () => {
  it("says Blipr's own wording when the watch has none", () => {
    expect(messageFor(watch, occasion)).toEqual({
      title: "It's gone",
      message: ".spinner is no longer on the page.",
    });
    expect(messageFor({ ...watch, condition: "appears" }, occasion).title).toBe("It showed up");
  });

  it("prefers the watch's own wording", () => {
    expect(messageFor({ ...watch, title: "Build done", message: "Go look." }, occasion)).toEqual({
      title: "Build done",
      message: "Go look.",
    });
  });

  it("falls back one field at a time, so a custom title keeps the standard message", () => {
    const blip = messageFor({ ...watch, title: "Build done", message: "" }, occasion);
    expect(blip.title).toBe("Build done");
    expect(blip.message).toBe(".spinner is no longer on the page.");
  });

  it("fills placeholders in both fields", () => {
    const blip = messageFor(
      { ...watch, title: "{matches} left", message: "{selector} on {url}" },
      { matches: 3, url: "https://example.com/ci/42" },
    );
    expect(blip).toEqual({
      title: "3 left",
      message: ".spinner on https://example.com/ci/42",
    });
  });
});

describe("fill", () => {
  it("knows the selector, the match count and the page URL", () => {
    expect(fill("{selector} {matches} {url}", facts)).toBe(".spinner 0 https://example.com/ci/42");
  });

  it("leaves a placeholder it does not know exactly as typed, never dropping it", () => {
    expect(fill("{ticket} is {selector}", facts)).toBe("{ticket} is .spinner");
    expect(fill("{ }, {}, { selector }", facts)).toBe("{ }, {}, { selector }");
  });

  it("leaves text with no placeholders alone", () => {
    expect(fill("Ready", facts)).toBe("Ready");
    expect(fill("", facts)).toBe("");
  });
});
