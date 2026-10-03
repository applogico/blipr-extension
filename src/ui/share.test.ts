/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SharedWatch } from "../core/share.js";
import { NOT_A_SHARE, shareWatch } from "../core/share.js";
import { copiedCallout, pasteScreen } from "./share.js";

const json = shareWatch({
  urlPattern: "https://example.com/*",
  selector: ".x",
  condition: "gone",
  priority: 3,
  once: true,
});

function mount(inDialog: boolean) {
  const onContinue = vi.fn<(shared: SharedWatch) => void>();
  const onBack = vi.fn();
  document.body.replaceChildren(...pasteScreen({ inDialog, onBack, onContinue }));
  const area = document.querySelector("textarea");
  const go = [...document.querySelectorAll("button")].find((b) => b.textContent === "Continue");
  if (!area || !go) throw new Error("paste screen is missing its parts");
  const type = (text: string) => {
    area.value = text;
    area.dispatchEvent(new Event("input"));
  };
  return { area, go, type, onContinue, onBack };
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => setTimeout(run, 0));
});

describe("pasteScreen", () => {
  it("starts with Continue off and no error", () => {
    const { go } = mount(false);
    expect(go.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".err-line")?.hidden).toBe(true);
  });

  it("says why a paste is not a watch and keeps Continue off", () => {
    const { go, area, type } = mount(false);
    type('{ "name": "x" }');
    expect(go.disabled).toBe(true);
    expect(document.querySelector(".err-line")?.textContent).toBe(NOT_A_SHARE);
    expect(area.getAttribute("aria-invalid")).toBe("true");
  });

  it("hands a valid paste, code fence and all, to Continue", () => {
    const { go, type, onContinue } = mount(false);
    type("```\n" + json + "\n```");
    expect(go.disabled).toBe(false);
    go.click();
    expect(onContinue).toHaveBeenCalledWith({
      urlPattern: "https://example.com/*",
      selector: ".x",
      condition: "gone",
      priority: 3,
      once: true,
      cooldownSeconds: 10,
    });
  });

  it("offers Cancel in a dialog and Back on a screen", () => {
    mount(true);
    const cancel = [...document.querySelectorAll("button")].find((b) => b.textContent === "Cancel");
    expect(cancel).toBeDefined();
    mount(false);
    expect(document.querySelector(".screen-hd button")?.textContent).toBe("Back");
  });
});

describe("copiedCallout", () => {
  it("says what went with the copy and what did not", () => {
    const text = copiedCallout().textContent;
    expect(text).toContain("Copied. Paste it to anyone who uses Blipr.");
    expect(text).toContain("Not your server or topic. They use their own.");
  });
});
