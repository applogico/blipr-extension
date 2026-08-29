// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { pick, shapeOf, similarSelector, tryCount, uniqueSelector } from "./selector.js";

const html = (markup: string) => {
  document.body.innerHTML = markup;
  return document.body;
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("uniqueSelector", () => {
  it("prefers a unique id", () => {
    html(`<div id="run"><span class="spinner"></span></div>`);
    expect(uniqueSelector(document.querySelector("#run")!)).toBe("#run");
  });

  it("ignores an id a framework generated", () => {
    html(`<div id="css-1a2b3c4d5e"><b></b></div>`);
    expect(uniqueSelector(document.querySelector("b")!)).not.toContain("css-1a2b3c4d5e");
  });

  it("matches exactly one element", () => {
    html(`<ul><li class="step"></li><li class="step"></li><li class="step"></li></ul>`);
    const selector = uniqueSelector(document.querySelectorAll("li")[1]!);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(document.querySelectorAll("li")[1]);
  });
});

describe("similarSelector", () => {
  it("generalizes to every peer that shares a class", () => {
    html(`<div><i class="spinner"></i><i class="spinner"></i><i class="spinner"></i></div>`);
    const selector = similarSelector(document.querySelector("i")!);
    expect(selector).toBe("i.spinner");
    expect(document.querySelectorAll(selector!)).toHaveLength(3);
  });

  it("declines when the element stands alone", () => {
    html(`<div><i class="only"></i></div>`);
    expect(similarSelector(document.querySelector("i")!)).toBeNull();
  });

  it("declines a bare tag, which would generalize too far", () => {
    html(`<div><i></i><i></i></div>`);
    expect(similarSelector(document.querySelector("i")!)).toBeNull();
  });
});

describe("pick", () => {
  it("offers both, with the count that shows what the user is choosing", () => {
    html(`<div><i class="spinner"></i><i class="spinner"></i></div>`);
    const result = pick(document.querySelector("i")!);
    expect(document.querySelectorAll(result.unique)).toHaveLength(1);
    expect(result.similar).toEqual({ selector: "i.spinner", matches: 2 });
  });
});

describe("tryCount", () => {
  it("reports a count, and an unusable selector as an error", () => {
    html(`<b class="x"></b><b class="x"></b>`);
    expect(tryCount(document, ".x")).toEqual({ matches: 2 });
    expect(tryCount(document, "((")).toEqual({ error: "That is not a valid CSS selector." });
  });
});

describe("shapeOf", () => {
  it("labels an element by what it is, ignoring generated classes", () => {
    html(`<i class="spinner css-1a2b3c4d"></i>`);
    expect(shapeOf(document.querySelector("i")!)).toBe("i.spinner");
  });

  it("falls back to the bare tag when nothing survives", () => {
    html(`<section></section>`);
    expect(shapeOf(document.querySelector("section")!)).toBe("section");
  });
});
