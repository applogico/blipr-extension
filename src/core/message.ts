// What a blip says. The wording is the watch's own when it has any and Blipr's
// otherwise, with the few placeholders filled in from what the page looked like
// the moment the condition was met.
import type { Watch } from "./watch.js";

export type Blip = { title: string; message: string };

/** What the page looked like when the condition was met. */
export type Occasion = { matches: number; url: string };

export type Wording = Pick<Watch, "selector" | "condition" | "title" | "message">;

type Facts = Occasion & { selector: string };

export function messageFor(watch: Wording, occasion: Occasion): Blip {
  const standard = standardWording(watch);
  const facts = { selector: watch.selector, ...occasion };
  return {
    title: fill(watch.title ?? "", facts) || standard.title,
    message: fill(watch.message ?? "", facts) || standard.message,
  };
}

/** A placeholder Blipr does not know is left exactly as it was typed, never dropped. */
export function fill(template: string, facts: Facts): string {
  const values: Record<string, string> = {
    selector: facts.selector,
    matches: String(facts.matches),
    url: facts.url,
  };
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}

function standardWording(watch: Wording): Blip {
  return watch.condition === "appears"
    ? { title: "It showed up", message: `${watch.selector} appeared on the page.` }
    : { title: "It's gone", message: `${watch.selector} is no longer on the page.` };
}
