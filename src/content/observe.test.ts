// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { DOM_CHANGES } from "./observe.js";

let observer: MutationObserver | null = null;

const watching = (): MutationObserver => {
  observer = new MutationObserver(() => undefined);
  observer.observe(document.documentElement, DOM_CHANGES);
  return observer;
};

afterEach(() => {
  observer?.disconnect();
  observer = null;
  document.documentElement.className = "";
  document.body.innerHTML = "";
});

describe("DOM_CHANGES", () => {
  it("sees a class toggling on the root element", () => {
    const seen = watching();
    document.documentElement.classList.add("dark");
    expect(seen.takeRecords().map((record) => record.attributeName)).toEqual(["class"]);
  });

  it("sees both halves of a toggle, so a flip and a flip back are two changes", () => {
    const seen = watching();
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("dark");
    expect(seen.takeRecords()).toHaveLength(2);
  });

  it("sees an attribute a selector might match on that is not class or style", () => {
    document.body.innerHTML = `<div id="job"></div>`;
    const seen = watching();
    document.querySelectorAll("#job")[0]?.setAttribute("data-state", "failed");
    expect(seen.takeRecords().map((record) => record.attributeName)).toEqual(["data-state"]);
  });

  it("still sees an element arriving and leaving", () => {
    const seen = watching();
    const node = document.createElement("span");
    document.body.append(node);
    node.remove();
    expect(seen.takeRecords().map((record) => record.type)).toEqual(["childList", "childList"]);
  });
});
