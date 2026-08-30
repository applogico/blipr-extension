# AMO source code submission

AMO requires the source when the reviewed files were produced by a build step. Blipr's are: every
JavaScript file in the uploaded zip is an esbuild bundle of the TypeScript in `src/`, so the
answer to "Do you use tools to generate the code you are submitting?" is **yes**, and a source
archive has to go up with the package.

The code is not minified and not obfuscated. `build.mjs` sets `minify: false` and
`sourcemap: true` on purpose, so a reviewer can read the bundles directly and can step through
them against the sources.

---

## Producing the two uploads

```sh
npm ci
npm run package         # the reviewed packages
npm run package:source  # the source archive
```

That leaves three files in `dist/`:

| File                     | What it is                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `dist/blipr-firefox.zip` | **the AMO upload.** The whole of `dist/firefox`, zipped from inside that directory so `manifest.json` sits at the root of the archive. |
| `dist/blipr-chrome.zip`  | the Chrome Web Store upload, built from `dist/chrome`. Not used by AMO.                                                                |
| `dist/blipr-source.zip`  | **the source archive.** The repository, without `node_modules`, without `dist`, without `.git`, and without any zip.                   |

`dist/chrome` and `dist/firefox` are two complete, independently loadable extensions. They share
no runtime code, and each gets its own manifest generated from `src/manifest.ts`. Only the Firefox
tree matters to AMO.

---

## Build instructions, to paste into the source submission field

> **Operating system:** any. Built and verified on macOS 15 (arm64) and on Ubuntu 24.04 in CI. No
> platform-specific step is involved.
>
> **Node.js:** 22 LTS. The upload was produced with **Node 22.20.0** and the **npm 10.9.3** that
> ships with it. `.github/workflows/ci.yml` pins the same major with `node-version: 22`.
>
> **Build:**
>
> ```sh
> npm ci
> npm run build
> ```
>
> `npm ci` installs the exact dependency versions in `package-lock.json`. `npm run build` runs
> `build.mjs`, which uses esbuild to bundle four entry points (`src/background/index.ts`,
> `src/content/index.ts`, `src/popup/index.ts`, `src/options/index.ts`) into IIFE bundles, copies
> `icons/` and the two HTML and CSS pairs, and writes `manifest.json` from `src/manifest.ts`.
> Nothing is minified. Nothing is downloaded at build time beyond the npm install.
>
> **What to compare against the uploaded file:** the build writes `dist/firefox/`. The uploaded
> zip is the contents of that directory, with `manifest.json` at the top level of the archive.
> `dist/chrome/` is the same extension built for Chrome and is not part of this submission.
>
> **Optional checks:** `npm run typecheck`, `npm run lint`, `npm test`, and
> `npm run lint:ext` (which is `web-ext lint --source-dir dist/firefox`) all pass on this source.

---

## Notes for the reviewer box

Worth saying alongside the source, because it is unusual in our favour and a reviewer will
otherwise go looking for it:

> The add-on declares `<all_urls>` under `optional_host_permissions`, never under
> `host_permissions`. Installing it grants access to no site. Each watch requests its own origin
> from inside the click that saves it, and the content script is registered at runtime only for
> origins that were granted and that still have an enabled watch. Revoking a site stops the
> watching immediately. There are no static `content_scripts`.
>
> The add-on loads no remote code. `@blipr/js`, the only runtime dependency besides
> `webextension-polyfill`, is bundled at build time from npm.

If the data collection declaration in the manifest is queried, `store/privacy.md` has the exact
list of what is transmitted and when.

---

## Keeping the archives reproducible

`npm run package:source` excludes `node_modules`, `dist`, `.git`, `web-ext-artifacts` and any
stray zip. It includes `package-lock.json`, which is what makes `npm ci` reproduce the same build,
and it includes this `store/` directory, which is harmless and saves a reviewer wondering what
else the repository holds.

Re-run both package scripts for every submission. The version in the archives comes from
`package.json`, and AMO refuses a version number it has already seen.
