# Privacy disclosure

What the extension actually touches, written from the code rather than from intent. The store
forms below are answered from this section, and so is the extension section of
`https://blipr.dev/privacy`. If any of the three drift apart, this file is the one to correct
first, because it is the one checkable against `src/`.

---

## What the extension reads

**Page content, on granted sites only.** The content script runs on the origins the user allowed
and nowhere else. On every DOM mutation, debounced to a quarter of a second, and on a five second
poll, it runs the watch's CSS selector against the document. If the watch has a "Text contains"
value it also reads the visible text of the matched elements and compares it, case insensitively,
against that value. The result of all of it is a single number: how many elements matched. The
text itself is discarded in the same tick.

**The address of a page that has a watch on it, or that the popup is open on.** The content script
reads `location.href` so the background can tell it which watches apply. The popup reads the
active tab's URL so it can suggest a URL pattern. The extension does not read the address of any
other tab, and it holds no `tabs` permission, so it cannot enumerate the tabs a user has open.

**One element, when the user picks it.** During picking, the extension reads the clicked element's
tag, id and class names to compute a CSS selector for it. It reads no other element and no
attribute values beyond those.

## What is stored, and where

Every watch lives in `chrome.storage.local` on that machine: URL pattern, CSS selector, optional
text to match, appears or is gone, topic, server, priority, once or every time, cooldown,
refresh interval, the timestamps that stop a watch double firing, and the last error a publish
returned. The same area holds the last-used topic, server and priority so a new watch starts
prefilled. `chrome.storage.session` holds a half-finished form and the element the user just
picked, keyed by tab, dropped when the tab closes.

Nothing is written to `chrome.storage.sync`, so none of it is copied to a browser profile on
another machine. Watches are never handed to a content script: the page only ever receives an id,
a selector, an optional text to match, and whether the watch is looking for appears or is gone.
The topic and the server address never enter a web page.

## What leaves the device

One thing, and only when a watch fires or the user clicks "Send test blip": a single HTTPS POST to
the server configured on that watch. That is `https://blipr.dev` unless the user typed their own.

The request is `POST {server}/blip/{topic}` and carries:

| Part                | Value                         |
| ------------------- | ----------------------------- |
| URL path            | the topic name the user typed |
| Body                | the blip's message text       |
| `X-Title` header    | the blip's title text         |
| `X-Priority` header | the watch's priority, 1 to 5  |

No `Authorization` header: the extension has no token field, so it publishes anonymously. No
cookies, no identifiers of its own, no analytics beacon alongside it.

**The message text contains page-derived data.** With no custom wording, the message Blipr writes
is `"{selector} appeared on the page."` or `"{selector} is no longer on the page."`, so the
**CSS selector** is in every blip by default. A user who writes their own title or message can use
three placeholders, which are filled in at the moment the blip is sent:

- `{selector}` puts the watch's CSS selector in.
- `{matches}` puts in **how many elements matched**, a number derived from the page.
- `{url}` puts in the **full address of the page** the watch was on.

`{matches}` and `{url}` are only sent when the user has typed that placeholder into their own
wording. Blipr's default wording uses neither, so out of the box a page address never leaves the
machine. The capability is there and is one text field away, which is why both are declared below
rather than argued away.

As with any HTTP request, the receiving server sees the source IP address. Blipr adds nothing to
that.

## What never leaves the device

Page text, HTML, images, links and form values. The list of watches. The browsing history: Blipr
has no access to it and no permission that would grant it. There is no analytics SDK, no
telemetry, no crash reporter, no advertising identifier, and no remote code of any kind. Every
line of JavaScript that runs ships inside the package.

## After it leaves

A blip that reaches `blipr.dev` is handled under the Blipr privacy policy at
`https://blipr.dev/privacy`: it is relayed to Apple Push Notification service for delivery to the
user's iPhone. A user who points a watch at their own server has nothing pass through
Applogico infrastructure at all.

---

## Chrome Web Store: Privacy practices tab, answered

Paste these into the dashboard. The wording is deliberately plain.

**Single purpose description**

> Blipr watches a page the user has open for a CSS selector they chose, and sends a push
> notification to their phone when that selector starts matching or stops matching. Everything in
> the extension serves that one purpose.

**Are you using remote code?**

> No, I am not using remote code.

All executable code is in the package. The bundles are produced by esbuild at build time from the
sources in the repository; nothing is fetched, `eval`ed, or loaded from a remote host at runtime.

**Data usage: what does your item collect?**

Check these two:

- **Website content.** The blip Blipr sends carries the CSS selector by default, and the user's
  own wording can add the number of elements that matched. Both are derived from the page.
- **Web history.** The user's own wording can include `{url}`, which sends the address of the
  watched page to the configured server.

Leave these seven unchecked, and each is a claim the code supports:

- Personally identifiable information: none is read, and there is no sign-in in the browser.
- Health information: none.
- Financial and payment information: none.
- Authentication information: no credentials, cookies or tokens are read or sent.
- Personal communications: none read.
- Location: no geolocation API is used and no location is inferred.
- User activity: no clicks, keystrokes, mouse position, scrolling or network activity is recorded.
  The extension observes DOM mutations, not the person.

**Note on the two that are checked.** A stricter reading says Blipr collects nothing, because the
selector and the wording are text the user typed and the URL is only sent if they ask for it. That
reading is defensible and it is the wrong bet. Under-declaring is what gets an item pulled after
launch; over-declaring costs nothing but a line on the listing. Declare both.

**Certifications** (all three are true and can be checked):

- Data is not sold or transferred to third parties outside the approved use cases. The only
  recipient is the server the user configured, which is the item's core function.
- Data is not used or transferred for any purpose unrelated to the item's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending.

**Privacy policy URL**

> https://blipr.dev/privacy

Required, because the item requests host permissions. The extension section on that page has to be
live before this submission goes in.

---

## AMO: the data collection declaration

Firefox reads this from the manifest, not from the submission form. `src/manifest.ts` currently
declares:

```
data_collection_permissions: { required: ["none"] }
```

**This needs an owner decision before submitting, and it is the highest review risk in the
package.** `none` states that the add-on collects and transmits no user data. Under the strict
reading that is true: the selector and the wording are typed by the user, and no page address is
transmitted unless they write `{url}` themselves. Under the reading the Chrome answers above take,
it is not, because a page address and a page-derived count can be transmitted.

The two ways to settle it:

1. Keep `["none"]` and explain the reasoning in the notes to the reviewer, quoting the "what leaves
   the device" section above. If a reviewer disagrees, the fix is a manifest change and a new
   version, which costs a review cycle.
2. Declare the collection up front. Firefox supports an `optional` list alongside `required`, which
   is the shape that actually matches the code: nothing is transmitted about the page unless the
   user opts in by typing a placeholder. Check the current AMO documentation for the exact accepted
   strings before changing this, because an invalid value fails validation at upload.

Whichever is chosen, `store/privacy.md`, the manifest, and `blipr.dev/privacy` have to agree.
