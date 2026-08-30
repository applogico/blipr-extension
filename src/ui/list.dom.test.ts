// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { Watch } from "../core/watch.js";
import { renderList } from "./list.js";

const watch: Watch = {
  id: "w1",
  urlPattern: "https://example.com/*",
  selector: ".ticket-row",
  condition: "gone",
  topic: "tickets",
  server: "https://blipr.dev",
  priority: 3,
  once: true,
  enabled: true,
};

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.append(root);
});

const rows = () => [...root.querySelectorAll(".watch")];
const matchLine = (index = 0) => rows()[index]?.querySelector(".match")?.textContent.trim() ?? "";

describe("renderList, text filter", () => {
  it("shows the text next to the selector when the watch has one", () => {
    renderList(root, [{ ...watch, containsText: "Sold out" }]);
    expect(matchLine()).toBe('.ticket-row containing "Sold out"');
  });

  it("shows the selector alone when the watch has no text", () => {
    renderList(root, [watch]);
    expect(matchLine()).toBe(".ticket-row");
    expect(rows()[0]?.querySelector(".contains")).toBeNull();
  });

  it("tells apart two watches that differ only by their text", () => {
    renderList(root, [
      { ...watch, id: "a", containsText: "Sold out" },
      { ...watch, id: "b", containsText: "In stock" },
    ]);
    expect(matchLine(0)).toBe('.ticket-row containing "Sold out"');
    expect(matchLine(1)).toBe('.ticket-row containing "In stock"');
    expect(matchLine(0)).not.toBe(matchLine(1));
  });

  it("keeps the selector and the text in one line of the row", () => {
    renderList(root, [{ ...watch, containsText: "Sold out" }]);
    const match = rows()[0]?.querySelector(".match");
    expect(match?.querySelector("code")?.textContent).toBe(".ticket-row");
    expect(match?.querySelector(".contains")?.textContent).toBe('containing "Sold out"');
  });

  it("still counts by watch id, so two watches on one selector count separately", () => {
    renderList(
      root,
      [
        { ...watch, id: "a", containsText: "Sold out" },
        { ...watch, id: "b", containsText: "In stock" },
      ],
      { counts: { a: 2, b: 7 } },
    );
    const badges = [...root.querySelectorAll(".badge")].map((n) => n.textContent);
    expect(badges).toContain("matches 2 elements now");
    expect(badges).toContain("matches 7 elements now");
  });
});
