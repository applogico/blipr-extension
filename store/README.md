# Store submission

Everything needed to put Blipr in the Chrome Web Store and on addons.mozilla.org, except the
things only a person with the accounts can do. Work top to bottom.

| File                 | What it is for                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `listing.md`         | Name, short summary, full description, categories, search terms. Paste into both stores.   |
| `permissions.md`     | One justification per declared permission. Chrome requires these; AMO reviewers read them. |
| `privacy.md`         | What the extension touches, and both stores' privacy forms answered.                       |
| `amo-source.md`      | The build instructions AMO requires alongside the source archive.                          |
| `screenshots/`       | Four 1280x800 PNGs, rendered from the real popup and options pages.                        |
| `store-icon-128.png` | The listing icon for Chrome: the app icon at 96px on a transparent 128px canvas.           |
| `screenshots.mjs`    | Regenerates the screenshots and the listing icon. See the bottom of this file.             |

---

## 1. Decisions to settle before uploading anything

These are yours. Nothing else can proceed past them.

1. **The Firefox data collection declaration.** `src/manifest.ts` says
   `data_collection_permissions: { required: ["none"] }`. Blipr does transmit a page-derived count
   and, if the user writes `{url}` into their own wording, a page address. Read the last section
   of `privacy.md` and decide whether to keep `none` and defend it in the reviewer notes, or
   declare the collection. This is the single highest review risk in the submission.
2. **A topic a reviewer can publish to.** Neither store's reviewer has an iPhone with Blipr on it,
   so nobody can see a blip arrive. What they can verify is the publish: "Send test blip" on the
   options page returns success or an error. Publishing to a topic that does not exist is refused
   with a 404, so **create a throwaway public topic in the Blipr app** (something like
   `store-review`), put its name in the reviewer notes of both stores, and delete it once both
   items are live. Without this, a reviewer clicking the one obvious button gets an error.
3. **Which Firefox applications to list.** The manifest sets `strict_min_version: 128.0`. Firefox
   for Android is not tested. Unless you want to test it first, list **Firefox for Desktop only**;
   adding Android later is a listing edit, not a new version.
4. **Whether to change the extension's name.** Chrome takes the listing title from `name` in the
   manifest, so the store title is "Blipr" unless the manifest changes. `listing.md` recommends
   leaving it. Decide now: changing it after launch renames the item for existing users.

## 2. Build the uploads

```sh
npm ci
npm run package         # dist/blipr-chrome.zip and dist/blipr-firefox.zip
npm run package:source  # dist/blipr-source.zip, for AMO only
```

Check `dist/chrome/manifest.json` says `"version": "1.0.0"` before uploading. Both stores refuse a
version number they have already accepted, so every resubmission needs the version in
`package.json` bumped first.

## 3. Chrome Web Store

**Account, once.** Register at `https://chrome.google.com/webstore/devconsole` with the Google
account that should own the item. There is a **one-time 5 USD registration fee**, and Google
verifies the account's contact email before anything can be published. Set the publisher display
name deliberately: it appears on the listing, and it should read as Applogico rather than a
personal name.

**Then, in order:**

1. **New item**, upload `dist/blipr-chrome.zip`. The version, name, icon set and short summary all
   come from inside the zip. If the upload is rejected for the manifest, fix and rebuild rather
   than editing anything in the dashboard.
2. **Store listing tab.**
   - Description: the full description from `listing.md`, asterisks stripped. Chrome renders it as
     plain text.
   - Category: **Workflow & Planning**.
   - Language: English (United States).
   - Store icon: upload `store/store-icon-128.png`.
   - Screenshots: upload all four from `store/screenshots/`, in filename order. The first one is
     the tile shown in search results, so keep `01-popup-new-watch.png` first.
   - Promo tiles: optional, and only used if the item is ever featured. Skip for launch.
   - Official URL / homepage: `https://blipr.dev`. Support URL: the public repository.
3. **Privacy practices tab.** Every field here is answered in `privacy.md`: single purpose
   description, one justification per permission from `permissions.md`, host permission
   justification, "not using remote code", the two data categories to check and the seven to leave
   alone, all three certifications, and the privacy policy URL `https://blipr.dev/privacy`. Chrome
   will not let you submit with any justification blank.
4. **Distribution tab.** Visibility **Public**, all regions, free. This is also where Chrome asks
   for the **trader or non-trader declaration** required for distribution in the EU. Answer it as
   the business, not as an individual, if the item is published under Applogico.
5. **Submit for review.** Expect longer than the usual few days: an item that requests broad host
   permissions, even optional ones, goes down a stricter path. Do not resubmit while a review is
   pending; it restarts the clock.

## 4. addons.mozilla.org

**Account, once.** A Mozilla account at `https://addons.mozilla.org/developers/`. No fee.

**Then, in order:**

1. **Submit a New Add-on**, choose **On this site** so it is listed publicly.
2. Upload `dist/blipr-firefox.zip`. Validation runs immediately; it should come back clean, and
   `npm run lint:ext` is the same validator if you want to see it first.
3. AMO asks **"Do you use tools to generate the code you are submitting?"**. Answer **yes** and
   upload `dist/blipr-source.zip`. Paste the build instructions block from `amo-source.md` into
   the field beside it. Skipping this stalls the review.
4. **Listing details:**
   - Name: **Blipr**.
   - Summary: the same 120 character line as Chrome's short summary, from `listing.md`.
   - Description: the same full description. AMO accepts a small set of HTML, so `<strong>` on the
     heading lines and `<p>` between paragraphs reads better than plain text.
   - Category: **Alerts & Updates**.
   - Tags: from `listing.md`, picking only from the list AMO offers.
   - Support email and support site.
   - License: **MIT**, which matches `LICENSE` in the repository.
   - Privacy policy: link to `https://blipr.dev/privacy`.
5. **Notes for reviewers.** Paste the reviewer block from `amo-source.md`, plus the test topic from
   step 1.2 above, plus one line saying blips are received in the Blipr iOS app so no notification
   will arrive on the review machine.
6. Submit. AMO usually clears a listed add-on in a few days, longer when source review is involved.

## 5. What only a human can answer

Collected in one place so nothing blocks halfway through a form:

- The Google account and Mozilla account that own the items, and the 5 USD Chrome fee.
- The publisher display name shown on the Chrome listing.
- A **public support email**. Chrome shows it on the listing, so it must be one you are happy to
  publish.
- The EU trader or non-trader declaration in Chrome's distribution tab.
- Identity verification, if Chrome asks for it on a new account.
- The reviewer test topic, created in the Blipr app.
- The two manifest decisions in section 1.

## 6. After both are live

- Update the **Install** section of the repository README, which currently says "Not in the stores
  yet" and tells people to load unpacked.
- Add the store links to `blipr.dev` wherever the iOS app is linked.
- Keep `store/` current: it is the source for the next submission, and both stores make you paste
  the description again on any listing edit.

---

## Regenerating the images

The screenshots are rendered from the real built pages, not drawn by hand, so they can be rebuilt
whenever the UI changes:

```sh
npm run build
npm i --no-save playwright && npx playwright install chromium
node store/screenshots.mjs
```

`screenshots.mjs` serves `dist/chrome` over a local port, replaces the extension APIs the pages
call with a stub holding sample watches, screenshots the popup and the options page, and composes
them at 1280x800. Playwright is deliberately not a dependency of the project: it is a 100 MB
download that has no business in the source archive AMO reviews.
