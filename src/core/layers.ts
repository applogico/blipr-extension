/**
 * Choosing what the picker means when several elements sit under the pointer.
 *
 * Some sites lay an empty, transparent link over a whole card so the card is
 * clickable; the topmost element is then that cover, not the text you see.
 * Pure on purpose: the picker measures the page and hands the facts in here.
 */

/** What the picker knows about one element under the pointer, topmost first. */
export type Layer = {
  /** Visible text or media of its own (text, img, svg, video, canvas, input). */
  hasContent: boolean;
  area: number;
};

/** A cover is empty and at least as large as the layer right beneath it. */
export function isCover(layer: Layer, beneath: Layer | undefined): boolean {
  if (layer.hasContent || !beneath) return false;
  return layer.area >= beneath.area * 0.9;
}

/** Index of the layer the picker should outline first: the topmost that is not a cover. */
export function firstUseful(layers: Layer[]): number {
  const found = layers.findIndex((layer, index) => !isCover(layer, layers[index + 1]));
  return found === -1 ? 0 : found;
}

/** Tab steps to the next layer under the pointer, wrapping; Shift+Tab steps back. */
export function stepLayer(current: number, count: number, backwards: boolean): number {
  if (count === 0) return 0;
  return (current + (backwards ? count - 1 : 1)) % count;
}
