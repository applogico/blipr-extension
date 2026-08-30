# Store listing copy

Everything a human pastes into the Chrome Web Store dashboard and the AMO submission form.
Copy rules for anything added here: no em dashes, benefit first, no marketing voice, no emoji, and
never name a use case. Blipr is for any alert.

---

## Name

**Blipr**

Chrome takes the listing title straight from `name` in the manifest, so the store title and the
toolbar name are the same string and cannot be set separately. AMO lets you type a name in the
form, but there is no reason to diverge: use **Blipr** there too, matching the iOS app.

If discovery ever looks weak, the lever is `name` in `src/manifest.ts` (something like
`Blipr: page watcher`). That is an owner call, not a listing-form change, and it renames the
toolbar button as well. Leaving it as **Blipr** is the recommendation: the summary below carries
the search terms, and the name matches the app people already have on their phone.

---

## Short summary (Chrome, 132 characters max)

> Watch any page for an element and get a push on your iPhone the moment it appears, or the moment
> the last one goes away.

120 characters.

Chrome reads this from `description` in the manifest, not from the dashboard. It is already set to
that string in `src/manifest.ts`. AMO's own **Summary** field (250 characters) takes the same text.

---

## Full description

Both stores take the same body. Chrome allows 16,000 characters, AMO 15,000, and this is well
under either.

> Blipr watches a page you already have open and pushes an alert to your iPhone the moment
> something on it turns up, or the moment the last one goes away.
>
> It is for anyone who keeps a tab open just to find out whether something has changed yet.
>
> **How a watch is made**
>
> Open the page and click the Blipr toolbar icon. Click Pick element, click the thing on the page
> you care about, and Blipr writes the CSS selector for you and says how many elements it matches
> right now. Choose whether to blip when that element appears or when it is gone, name the topic
> the blip goes to, and save.
>
> A watch is about a set of elements, not one. "Is gone" means the selector matches nothing at
> all, which is how you watch a page full of pending rows and get pinged when the last one
> finishes. You can also narrow a watch to elements whose text contains a word, so one selector
> can wait on one particular state.
>
> A watch never blips for what was already on the page when you made it. It starts from the state
> you were looking at and reports the next change.
>
> **What you need**
>
> Blips are delivered by Blipr at blipr.dev, and you receive them in the free Blipr app on your
> iPhone. Create the topic in the app first: publishing to a topic that does not exist is refused.
> You can point a watch at your own Blipr server instead.
>
> **Site access, one site at a time**
>
> Blipr installs with access to no website at all. Each watch asks for the one site it needs, at
> the moment you save it, and the page watcher runs only on the sites you allowed. Revoke a site
> in your browser's extension settings and that watching stops immediately. There is no blanket
> "read and change all your data on all websites" prompt at install.
>
> **What it does not do**
>
> No account, no sign-in in the browser, no analytics, no telemetry, no remote code. Your watches
> live in local storage on the machine you typed them into, are never synced, and never reach a
> content script. The extension talks to one server, the one you configured, and to nothing else.
>
> **Worth knowing before you install**
>
> A watch runs inside the page, so the tab has to stay open. Close it and the watch stops. A tab
> you are not looking at is throttled by the browser, and many sites stop updating themselves
> while hidden, so Blipr can reload a watched tab on a timer to keep it fresh. That is off by
> default and set per watch, and reloading discards anything unsaved on that page. Blipr never
> reloads the tab you are looking at.
>
> Blipr is open source under the MIT license.

**Formatting note.** Chrome renders the description as plain text: the `**bold**` markers above
are only headings for the human pasting, so drop the asterisks and leave the heading lines as
plain lines. AMO accepts a small set of HTML tags, so `<strong>` around those heading lines and
`<p>` between paragraphs is fine there.

---

## Category

**Chrome Web Store: Workflow & Planning.**
The item is a monitor that produces alerts, which is what that category collects. Developer Tools
is the obvious alternative and is the wrong call: CSS selectors are the mechanism, not the
audience, and that category buries the item under devtools panels.

**AMO: Alerts & Updates.**
An exact fit, and the shortlist AMO users browse when they want exactly this. AMO permits a
second category; leave it empty rather than reaching for one. Web Development is the only
plausible second and it narrows the audience for no gain.

---

## Search terms worth targeting

Chrome has no keyword field. Its search indexes the name, the summary and the description, so
these terms have to appear naturally in the description text above, and most of them do:

- page monitor, page watcher, watch a page
- website change detection, change monitor, page change alert
- notify me when, alert when a page changes
- push notification, phone notification, iPhone alert
- CSS selector, element appears, element disappears

AMO has a **Tags** field, limited to a fixed vocabulary and to ten entries. Pick from it, in this
order of value: `alerts`, `notifications`, `monitor`, `productivity`, `privacy`. Do not invent
tags; the form only accepts what it offers.

Terms deliberately not targeted: anything that names a use case (restocks, tickets, on-call,
trading, deploys). They would rank for a narrow audience and contradict what Blipr is.

---

## Support and homepage fields

- Homepage / website: `https://blipr.dev`
- Privacy policy URL: `https://blipr.dev/privacy` (the extension section)
- Support site / issue tracker: the public `applogico/blipr-extension` repository
- Support email: the address on the developer account. Chrome shows it publicly on the listing,
  so use one intended to be public.
