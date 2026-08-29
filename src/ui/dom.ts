export function need<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`This page is missing ${selector}.`);
  return node;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]>,
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** One place for the "message plus tone" line every page shows. */
export function show(node: HTMLElement, text: string, tone: "good" | "bad" | "warn"): void {
  node.textContent = text;
  node.className = `result ${tone}`;
  node.hidden = false;
}

export function listErrors(node: HTMLElement, messages: string[]): void {
  node.replaceChildren(...messages.map((text) => el("li", { textContent: text })));
  node.hidden = messages.length === 0;
}
