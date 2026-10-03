# Blipr for the browser

Watch any page for an element and get a push on your phone the moment it shows up — or the moment
it goes away. "Ping me when the ticket page stops saying sold out." "Ping me when every step on
this CI run finishes."

Blips are delivered by [Blipr](https://blipr.dev). You need the iOS app to receive them.

## Install

Get it from the [Chrome Web Store](https://chromewebstore.google.com/detail/blipr/dlnfnblappmldconmihnmocjdakpnhci). Firefox is not published yet.

To run it from source, build it and load it unpacked:

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
3. **Pick an element to watch**. Blipr asks the browser for access to that one site, and the popup
   gets out of the way. Hover the page to see the selector and how many things it matches, then
   click. Open Blipr again: the form is waiting with what you picked.
4. Choose whether to blip when it **appears** or when it **is gone**, and the topic. Your first
   watch offers to keep that topic as the default for new ones. Priority, repeat, tab refresh, the
   pages to watch and your own wording live under **More options**. Save.

The popup always shows what is watching the page you are on, and folds every other watch into one
line that still flags trouble: a paused watch (its page is not open in any tab) or one with an
error. The options page lists every watch grouped by site, and holds the settings: the server and
a connection check, the defaults for new watches, and the sites Blipr may read.

Every watch has a cooldown of at least 10 seconds between blips. Set the default in Settings.

A watch is about a _set_ of elements, not one. "Is gone" means the selector matches nothing, which
is how you watch a page full of spinners and get pinged when the last one finishes.

A watch never blips for what was already on the page when you made it. It starts from the state
you were looking at and blips on the next change — the element turning up after it was missing, or
the last one going away.

Manage or delete watches from the popup or the options page.

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

**Keep the tab fresh** (under More options) is the answer to that. Switch it on for a watch, give it a number of minutes,
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
- Switching it off keeps the interval, so switching it back on picks up where you left it.

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

## Release

Every push to `main` runs semantic-release: a `fix:` or `feat:` commit since the last tag cuts a
GitHub release with both zips attached, then uploads the Chrome zip to the Chrome Web Store and
submits it for review. The store step needs four repository secrets and skips itself with a note
when they are absent:

| Secret              | Where it comes from                                                                 |
| ------------------- | ----------------------------------------------------------------------------------- |
| `CWS_EXTENSION_ID`  | The id in the store listing URL.                                                    |
| `CWS_CLIENT_ID`     | A Google Cloud OAuth client (Desktop app) with the Chrome Web Store API enabled.    |
| `CWS_CLIENT_SECRET` | Same client.                                                                        |
| `CWS_REFRESH_TOKEN` | One-time consent flow for that client, see the `chrome-webstore-upload-cli` README. |

Google still reviews each upload; the listing updates when review passes. Firefox is not automated
yet: upload `dist/blipr-firefox.zip` to addons.mozilla.org by hand.

## Site access

Blipr installs with no access to any website. Each watch asks for its own origin when you save it,
and the page watcher is registered only for the origins you allowed — and unregistered again when
the last watch for an origin goes away. Watching stops the moment you revoke a site in the
browser's extension settings.

## Privacy

Your watches live in `chrome.storage.local` on the machine you typed them into. They are never
synced, and never reach a content script. The extension talks to exactly one server — the one you
configured — and to nothing else. No analytics, no telemetry, no remote code.

## License

MIT
