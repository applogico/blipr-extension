# Blipr for the browser

Watch any page for an element and get a push on your phone the moment it shows up — or the moment
it goes away. "Ping me when the ticket page stops saying sold out." "Ping me when every step on
this CI run finishes."

Blips are delivered by [Blipr](https://blipr.dev). You need the iOS app to receive them.

## Install

Not in the stores yet. Build it and load it unpacked:

```sh
npm install
npm run build
```

**Chrome / Edge / Brave** — open `chrome://extensions`, turn on Developer mode, choose
**Load unpacked**, and pick `dist/chrome`.

**Firefox** — open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and
pick `dist/firefox/manifest.json`. Temporary add-ons are removed when Firefox restarts.

## Use it

1. Create the topic in the Blipr app first. Publishing to a topic that does not exist is refused.
2. Open the page you want to watch and click the Blipr toolbar icon.
3. **Pick element**. Blipr asks the browser for access to that one site, and the popup gets out of
   the way — which is what picking does anyway. Click the thing on the page you care about, then
   open Blipr again: the selector is waiting, with a count of what it matches.
4. Choose whether to blip when it **appears** or when it **is gone**, name your topic, and save.
   Access is already granted, so saving is one click and no prompt.
5. If you type a selector by hand and never pick, saving asks for access instead. Blipr cannot
   watch a site you have not allowed, so declining means the watch is not saved.

A watch is about a _set_ of elements, not one. "Is gone" means the selector matches nothing, which
is how you watch a page full of spinners and get pinged when the last one finishes.

A watch never blips for what was already on the page when you made it. It starts from the state
you were looking at and blips on the next change — the element turning up after it was missing, or
the last one going away.

Manage or delete watches from the options page.

## Your own wording

By default a blip says Blipr's own thing: "It showed up", or "`.spinner` is no longer on the page."
Give a watch a title, a message, or both, and it sends yours instead. The two fall back
separately, so your own title can keep the standard message.

Three placeholders are filled in when the blip is sent:

| Placeholder  | Becomes                                     |
| ------------ | ------------------------------------------- |
| `{selector}` | the watch's CSS selector                    |
| `{matches}`  | how many elements it matched at that moment |
| `{url}`      | the page it was watching                    |

Anything else in braces is sent exactly as you typed it, so an invented `{ticket}` arrives as
`{ticket}` rather than quietly disappearing.

## Keep a hidden tab fresh

A watch runs inside the page, so the tab has to stay open — close it and the watch stops. A tab you
are not looking at is also throttled by the browser, and plenty of sites stop updating their own
DOM while they are hidden, so a change can go unnoticed until you look at the tab.

**Refresh the page** is the answer to that. Switch it on for a watch, give it a number of minutes,
and Blipr reloads that tab on the timer. A reload produces a fresh page whatever the site does in
the background.

- Off by default, and set per watch.
- **Reloading discards anything unsaved on the page.** Do not put it on a page you type into.
- Whole minutes, one minute at the fastest, because a browser alarm will not tick faster.
- The tab you are looking at is never reloaded. A visible tab is not throttled, so there is
  nothing to fix, and reloading it under you would be rude.
- Only a tab that is already open and matches the watch's URL pattern is reloaded. Blipr never
  opens one.
- A disabled watch, and a "once" watch that has already blipped, stop being refreshed.
- Once an interval is set, the watch's own row — in the popup and on the options page — carries a
  one-click switch, so you can start and stop the reloads without opening the form. The interval
  stays where you put it.

## Develop

```sh
npm run dev         # rebuild dist/chrome and dist/firefox on change
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run lint:ext    # web-ext lint against dist/firefox
npm run package     # zips for the stores
```

The two `dist/` trees are complete, independently loadable extensions. Nothing is shared between
them at runtime, and the manifest for each is generated from `src/manifest.ts`.

## Site access

Blipr installs with no access to any website. Each watch asks for its own origin when you save it,
and the page watcher is registered only for the origins you allowed — and unregistered again when
the last watch for an origin goes away. Watching stops the moment you revoke a site in the
browser's extension settings.

## Privacy

Config and tokens live in `chrome.storage.local` on the machine you typed them into. They are never
synced, and never reach a content script. The extension talks to exactly one server — the one you
configured — and to nothing else. No analytics, no telemetry, no remote code.

## License

MIT
