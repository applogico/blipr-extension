// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { pick, shapeOf, similarSelector, tryCount, uniqueSelector } from "./selector.js";

const html = (markup: string) => {
  document.body.innerHTML = markup;
  return document.body;
};

const q = (selector: string): Element => {
  const node = document.querySelectorAll(selector)[0];
  if (!node) throw new Error(`the fixture has no ${selector}`);
  return node;
};

const nth = (selector: string, index: number): Element => {
  const node = document.querySelectorAll(selector)[index];
  if (!node) throw new Error(`the fixture has no ${selector} at ${index}`);
  return node;
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("uniqueSelector", () => {
  it("prefers a unique id", () => {
    html(`<div id="run"><span class="spinner"></span></div>`);
    expect(uniqueSelector(q("#run"))).toBe("#run");
  });

  it("ignores an id a framework generated", () => {
    html(`<div id="css-1a2b3c4d5e"><b></b></div>`);
    expect(uniqueSelector(q("b"))).not.toContain("css-1a2b3c4d5e");
  });

  it("matches exactly one element", () => {
    html(`<ul><li class="step"></li><li class="step"></li><li class="step"></li></ul>`);
    const selector = uniqueSelector(nth("li", 1));
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(document.querySelectorAll("li")[1]);
  });
});

describe("similarSelector", () => {
  it("generalizes to every peer that shares a class", () => {
    html(`<div><i class="spinner"></i><i class="spinner"></i><i class="spinner"></i></div>`);
    const selector = similarSelector(q("i"));
    expect(selector).toBe("i.spinner");
    expect(document.querySelectorAll("i.spinner")).toHaveLength(3);
  });

  it("declines when the element stands alone", () => {
    html(`<div><i class="only"></i></div>`);
    expect(similarSelector(q("i"))).toBeNull();
  });

  it("declines a bare tag, which would generalize too far", () => {
    html(`<div><i></i><i></i></div>`);
    expect(similarSelector(q("i"))).toBeNull();
  });
});

describe("pick", () => {
  it("offers both, with the count that shows what the user is choosing", () => {
    html(`<div><i class="spinner"></i><i class="spinner"></i></div>`);
    const result = pick(q("i"));
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

describe("tryCount, text filter", () => {
  it("counts only the elements whose text contains the filter", () => {
    html(`<b class="x">Sold out</b><b class="x">In stock</b><b class="x">SOLD OUT today</b>`);
    expect(tryCount(document, ".x", "sold out")).toEqual({ matches: 2 });
  });

  it("counts everything when the filter is blank", () => {
    html(`<b class="x">Sold out</b><b class="x">In stock</b>`);
    expect(tryCount(document, ".x", "")).toEqual({ matches: 2 });
    expect(tryCount(document, ".x")).toEqual({ matches: 2 });
  });

  it("counts nothing when the filter matches nothing", () => {
    html(`<b class="x">In stock</b>`);
    expect(tryCount(document, ".x", "Sold out")).toEqual({ matches: 0 });
  });

  it("sees through the whitespace the markup puts in the element", () => {
    html(`<b class="x">\n      Sold\n      out\n    </b>`);
    expect(tryCount(document, ".x", "Sold out")).toEqual({ matches: 1 });
  });

  it("still reports an unusable selector rather than counting", () => {
    expect(tryCount(document, "((", "Sold out")).toEqual({
      error: "That is not a valid CSS selector.",
    });
  });
});

describe("shapeOf", () => {
  it("labels an element by what it is, ignoring generated classes", () => {
    html(`<i class="spinner css-1a2b3c4d"></i>`);
    expect(shapeOf(q("i"))).toBe("i.spinner");
  });

  it("falls back to the bare tag when nothing survives", () => {
    html(`<section></section>`);
    expect(shapeOf(q("section"))).toBe("section");
  });
});
