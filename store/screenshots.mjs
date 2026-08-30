// Regenerates store/screenshots/*.png from the real popup and options pages in
// dist/chrome, composed at the 1280x800 both stores accept. Nothing here draws
// UI of its own: every pixel of the extension comes from the built pages, with
// the browser APIs they call replaced by a stub holding sample watches.
//
//   npm run build
//   npm i --no-save playwright && npx playwright install chromium
//   node store/screenshots.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist", "chrome");
const outDir = join(root, "store", "screenshots");

const CANVAS = { width: 1280, height: 800 };
const WINDOW = { x: 48, y: 88, width: 1184, height: 688, bar: 44 };
const CONTENT = { width: WINDOW.width, height: WINDOW.height - WINDOW.bar };
const POPUP = { width: 368, height: 632 };

const PAGE_URL = "https://example.com/status";
const TAB_ID = 7;
const now = Date.now();

const SAVED = [
  {
    id: "8f2c1a90-0000-4000-8000-000000000001",
    urlPattern: "https://example.com/status*",
    selector: "span.status-badge",
    containsText: "Pending",
    condition: "gone",
    topic: "updates",
    server: "https://blipr.dev",
    priority: 4,
    once: false,
    enabled: true,
    cooldownSeconds: 5,
    refresh: true,
    refreshMinutes: 15,
    watchingSince: now - 90 * 60_000,
    lastFiredAt: now - 12 * 60_000,
  },
  {
    id: "8f2c1a90-0000-4000-8000-000000000002",
    urlPattern: "https://example.org/queue*",
    selector: "#queue .item",
    condition: "appears",
    topic: "alerts",
    server: "https://blipr.dev",
    priority: 3,
    once: true,
    enabled: true,
    cooldownSeconds: 5,
    watchingSince: now - 6 * 60_000,
  },
];

const PICK = { unique: "#status-2", similar: { selector: "span.status-badge", matches: 3 } };

const PICKED_DRAFT = {
  urlPattern: "https://example.com/status*",
  selector: "",
  containsText: "Pending",
  condition: "gone",
  topic: "updates",
  server: "https://blipr.dev",
  priority: 4,
  once: false,
  cooldownSeconds: 5,
};

const COUNTS = { "#status-2": 1, "span.status-badge": 2 };

const BACKDROP = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Example Co</title>
<style>
  :root { color-scheme: light }
  body { margin:0; padding:0; background:#fff; color:#1b1f27;
         font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif }
  header { display:flex; align-items:center; gap:12px; padding:18px 40px;
           border-bottom:1px solid #e6e9ef }
  .mark { width:26px; height:26px; border-radius:7px; background:#c9cfdb }
  header strong { font-size:15px; letter-spacing:-0.01em }
  nav { margin-left:auto; display:flex; gap:22px; color:#6b7280; font-size:14px }
  main { padding:34px 40px; max-width:700px }
  h1 { font-size:26px; letter-spacing:-0.02em; margin:0 0 6px }
  .sub { color:#6b7280; margin:0 0 26px; font-size:14px }
  .row { display:flex; align-items:center; gap:16px; padding:15px 18px;
         border:1px solid #e6e9ef; border-radius:10px; margin-bottom:10px }
  .row .name { font-weight:600 }
  .row .meta { color:#6b7280; font-size:13px }
  .status-badge { margin-left:auto; padding:4px 11px; border-radius:999px;
                  font-size:12.5px; font-weight:600 }
  .pending { background:#fff2d6; color:#8a5b00 }
  .ready { background:#dcf5e7; color:#12683f }
</style></head>
<body>
  <header><span class="mark"></span><strong>Example Co</strong>
    <nav><span>Overview</span><span>Status</span><span>Settings</span></nav></header>
  <main>
    <h1>Batch 4821</h1>
    <p class="sub">Three items. Updated a moment ago.</p>
    <div id="items">
      <div class="row"><span class="name">Item 001</span>
        <span class="meta">started 14:02</span>
        <span id="status-1" class="status-badge ready">Ready</span></div>
      <div class="row"><span class="name">Item 002</span>
        <span class="meta">started 14:06</span>
        <span id="status-2" class="status-badge pending">Pending</span></div>
      <div class="row"><span class="name">Item 003</span>
        <span class="meta">started 14:11</span>
        <span id="status-3" class="status-badge pending">Pending</span></div>
    </div>
  </main>
</body></html>`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".map": "application/json",
  ".json": "application/json",
};

function serve() {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    if (path === "/_page.html") {
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(BACKDROP);
      return;
    }
    const file = join(dist, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    readFile(file).then(
      (body) => {
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
        res.end(body);
      },
      () => {
        res.writeHead(404).end("no");
      },
    );
  });
  return new Promise((ready) => {
    server.listen(0, "127.0.0.1", () => {
      ready({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

/** Replaces the extension APIs the built pages call, seeded with `state`. */
function stubExtensionApis(state) {
  const area = (store) => ({
    async get(key) {
      if (key === null || key === undefined) return { ...store };
      const keys = Array.isArray(key) ? key : [key];
      return Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]]));
    },
    async set(items) {
      Object.assign(store, items);
    },
    async remove(keys) {
      for (const key of [].concat(keys)) delete store[key];
    },
  });
  const nothing = { addListener() {}, removeListener() {} };
  const replies = {
    takePick: () => state.pick,
    countMatches: ({ selector }) => ({ matches: state.counts[selector] ?? 0 }),
    watchesForUrl: () => [],
    saveWatch: () => ({ error: "This is a screenshot." }),
    testWatch: () => ({ error: "This is a screenshot." }),
  };
  globalThis.chrome = { runtime: { id: "screenshot" } };
  globalThis.browser = {
    runtime: {
      id: "screenshot",
      async sendMessage(message) {
        return replies[message.kind]?.(message);
      },
      onMessage: nothing,
      onStartup: nothing,
      onInstalled: nothing,
      openOptionsPage() {},
    },
    tabs: {
      async query() {
        return [{ id: state.tabId, url: state.pageUrl }];
      },
      async sendMessage() {},
      onRemoved: nothing,
    },
    storage: { local: area(state.local), session: area(state.session), onChanged: nothing },
    permissions: {
      async contains() {
        return true;
      },
      async request() {
        return true;
      },
      onAdded: nothing,
      onRemoved: nothing,
    },
    scripting: { async executeScript() {} },
    alarms: { onAlarm: nothing },
  };
}

async function shoot(browser, { url, viewport, state, settle }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  if (state) await page.addInitScript(stubExtensionApis, state);
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(400);
  if (settle) await settle(page);
  const shot = await page.screenshot({ type: "png" });
  await page.close();
  return `data:image/png;base64,${shot.toString("base64")}`;
}

function frame({ caption, content, popup, address, icon }) {
  const overlay = popup
    ? `<img class="popup" src="${popup}" width="${POPUP.width}" height="${POPUP.height}" alt="">`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { color-scheme: light }
    body { margin:0; width:${CANVAS.width}px; height:${CANVAS.height}px; overflow:hidden;
           background:linear-gradient(160deg,#eef1f8 0%,#e3e8f4 100%);
           font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; color:#16181d }
    .caption { position:absolute; top:32px; left:0; right:0; text-align:center;
               font-size:19px; font-weight:600; letter-spacing:-0.01em; color:#252a34 }
    .window { position:absolute; left:${WINDOW.x}px; top:${WINDOW.y}px;
              width:${WINDOW.width}px; height:${WINDOW.height}px; border-radius:12px;
              background:#fff; overflow:hidden; box-shadow:0 20px 50px rgba(20,26,45,0.20) }
    .bar { display:flex; align-items:center; gap:10px; height:${WINDOW.bar}px;
           padding:0 14px; background:#f3f4f8; border-bottom:1px solid #e2e5ee }
    .dot { width:11px; height:11px; border-radius:50% }
    .pill { flex:1; margin:0 8px; height:26px; border-radius:13px; background:#fff;
            border:1px solid #e2e5ee; display:flex; align-items:center; padding:0 12px;
            color:#5c6370; font-size:12.5px }
    .icon { width:22px; height:22px; border-radius:5px }
    .stage { position:relative; width:${CONTENT.width}px; height:${CONTENT.height}px }
    .stage > img.page { display:block; width:${CONTENT.width}px; height:${CONTENT.height}px }
    .popup { position:absolute; right:12px; top:6px; border-radius:10px;
             border:1px solid rgba(20,26,45,0.14);
             box-shadow:0 14px 34px rgba(20,26,45,0.26) }
  </style></head><body>
    <div class="caption">${caption}</div>
    <div class="window">
      <div class="bar">
        <span class="dot" style="background:#ff5f57"></span>
        <span class="dot" style="background:#febc2e"></span>
        <span class="dot" style="background:#28c840"></span>
        <span class="pill">${address}</span>
        <img class="icon" src="${icon}" alt="">
      </div>
      <div class="stage">
        <img class="page" src="${content}" alt="">
        ${overlay}
      </div>
    </div>
  </body></html>`;
}

async function compose(browser, name, parts) {
  const page = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
  await page.setContent(frame(parts), { waitUntil: "load" });
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.screenshot({ path: join(outDir, name), type: "png" });
  await page.close();
  console.log(`store/screenshots/${name}`);
}

const server = await serve();
const browser = await chromium.launch();
const icon = `data:image/png;base64,${(await readFile(join(dist, "icons/icon-32.png"))).toString("base64")}`;

const base = { tabId: TAB_ID, pageUrl: PAGE_URL, counts: COUNTS, pick: null };
const popupUrl = `${server.origin}/popup/popup.html`;

const backdrop = await shoot(browser, { url: `${server.origin}/_page.html`, viewport: CONTENT });

const emptyPopup = await shoot(browser, {
  url: popupUrl,
  viewport: POPUP,
  state: { ...base, local: {}, session: {} },
});

const pickedPopup = await shoot(browser, {
  url: popupUrl,
  viewport: POPUP,
  state: {
    ...base,
    pick: PICK,
    local: { defaults: { topic: "updates", server: "https://blipr.dev", priority: 4 } },
    session: { [`draft:${TAB_ID}`]: PICKED_DRAFT },
  },
});

const savedPopup = await shoot(browser, {
  url: popupUrl,
  viewport: POPUP,
  state: { ...base, local: { watches: SAVED }, session: {} },
  settle: async (page) => {
    await page.evaluate(() => {
      document.querySelector("#current")?.scrollIntoView({ block: "end" });
    });
    await page.waitForTimeout(200);
  },
});

const optionsPage = await shoot(browser, {
  url: `${server.origin}/options/options.html`,
  viewport: CONTENT,
  state: { ...base, local: { watches: SAVED }, session: {} },
});

await compose(browser, "01-popup-new-watch.png", {
  caption: "Open Blipr on any page and say what to watch for.",
  address: "example.com/status",
  content: backdrop,
  popup: emptyPopup,
  icon,
});

await compose(browser, "02-popup-picked.png", {
  caption: "Click the element. Blipr writes the selector and counts what it matches.",
  address: "example.com/status",
  content: backdrop,
  popup: pickedPopup,
  icon,
});

await compose(browser, "03-popup-watching.png", {
  caption: "A saved watch shows what it matches now, and when it last blipped.",
  address: "example.com/status",
  content: backdrop,
  popup: savedPopup,
  icon,
});

await compose(browser, "04-options-watches.png", {
  caption: "Every watch on one page. Edit, disable, delete, or send a test blip.",
  address: "Blipr settings",
  content: optionsPage,
  popup: null,
  icon,
});

await storeIcon(browser);

await browser.close();
server.close();

/** The listing icon Chrome asks for: the 128px icon at 96px, on a transparent 128px canvas. */
async function storeIcon(browser) {
  const source = `data:image/png;base64,${(await readFile(join(dist, "icons/icon-128.png"))).toString("base64")}`;
  const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}
     img{position:absolute;left:16px;top:16px;width:96px;height:96px}</style>
     <img src="${source}" alt="">`,
    { waitUntil: "load" },
  );
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.screenshot({ path: join(root, "store", "store-icon-128.png"), omitBackground: true });
  await page.close();
  console.log("store/store-icon-128.png");
}
