/** Unfiltered: a selector may match on any attribute, and the callback is debounced anyway. */
export const DOM_CHANGES: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
};
