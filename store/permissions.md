# Permission justifications

One paragraph per permission actually declared in `src/manifest.ts`. Chrome asks for a
justification per permission in the Privacy tab of the dashboard and rejects the submission if any
is blank. AMO has no per-permission field, but a reviewer reads the same reasoning, so paste the
host access section into the "Notes to reviewer" box.

The declared set, verbatim from the manifest:

```
permissions: ["storage", "scripting", "activeTab", "alarms"]
optional_host_permissions: ["<all_urls>"]
```

There is no `tabs`, no `webRequest`, no `notifications`, no `host_permissions`, and no
`content_scripts` block. The content script is registered at runtime instead, for granted origins
only.

---

## `storage`

Every watch a user creates is kept in `chrome.storage.local`: the URL pattern, the CSS selector,
the optional text to match, whether to blip when the element appears or when it is gone, the topic
and server the blip is published to, the priority, the cooldown, and the timestamps that stop a
watch firing twice for one change. The same area holds the last-used topic, server and priority so
a new watch starts from them instead of an empty form. A small amount of `storage.session` holds a
half-finished form and the element the user just picked, keyed by tab and dropped when the tab
closes, because picking an element closes the popup mid-edit. Nothing is written to
`storage.sync`, so none of it leaves the machine it was typed on.

## `scripting`

The page watcher has to run inside the page to see the DOM change. `scripting` is used two ways.
`registerContentScripts` keeps one registration, `blipr-watch`, whose match list is exactly the
origins the user has granted and that still have an enabled watch; it is updated when a watch is
added or removed and unregistered entirely when the last watch for an origin goes away. A freshly
registered script only runs on the next page load, so `executeScript` injects the same file into
tabs that are already open, and injects it on demand when the popup needs to count what a selector
matches on the current tab. Both calls are limited to origins the user has already granted, and
the injected file is `content/index.js` from inside the extension. No code is fetched or evaluated
from anywhere else.

## `activeTab`

The element picker and the "Check selector" button act on the tab the user is looking at, in
direct response to a click in the popup. `activeTab` is what makes that work on a site the user
has not granted yet, so someone can try the picker on a page before deciding whether to give Blipr
standing access to it. It grants nothing until the toolbar button is clicked, and it expires when
the user navigates away.

## `alarms`

One optional feature uses alarms: a watch can reload its tab on a timer, because a background tab
is throttled by the browser and many sites stop updating their own DOM while hidden, so a change
can go unnoticed. The user sets the interval per watch in whole minutes, and it is off by default.
Alarms are also the only timer available to an MV3 service worker, which the browser stops roughly
thirty seconds after the last event handler finishes. Nothing else in the extension is scheduled:
a watch's cooldown is a stored timestamp rather than an alarm, precisely so nothing has to outlive
a handler.

---

## Host access, and why it is requested at runtime

`<all_urls>` appears under `optional_host_permissions`, never under `host_permissions`. The
practical difference is the one that matters to a reviewer: **installing Blipr grants it access to
no website at all.** There is no "read and change all your data on all websites" prompt at install
time, and immediately after installing, the extension cannot read a single page.

Access is asked for one origin at a time, from inside the click that saves a watch, because both
engines only allow `permissions.request` from a user gesture. Saving a watch on
`https://example.com/status` asks for `https://example.com/*` and nothing else. If the user
declines, the watch is not saved: the background refuses to store a watch whose origin it does not
hold, so there is no state where Blipr believes it is watching a site it cannot read. In practice
the prompt usually arrives even earlier, when the user clicks "Pick element", because picking has
to close the popup anyway and folding the two interruptions into one means saving afterwards needs
no prompt at all.

`<all_urls>` is the declared optional pattern only because a watch may be pointed at any site, and
an extension can only request an origin it declared up front. The set actually held at any moment
is the set of origins the user said yes to, and it shrinks on its own: when the last enabled watch
for an origin is deleted or disabled, the content script registration for it is dropped. Revoking
a site in the browser's own extension settings stops the watching immediately, because the
registration follows `permissions.onRemoved`.

A reviewer can confirm all of this without reading the diff: install the extension and check its
site access in `chrome://extensions`. It will say "On specific sites" with an empty list.
