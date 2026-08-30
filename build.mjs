// Builds a complete, independently loadable extension per target.
// Chrome and Firefox each get their own dist tree: own bundles, own HTML,
// own manifest. Nothing is shared across them at runtime.
import * as esbuild from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const targets = ["chrome", "firefox"];

const entryPoints = [
  "src/background/index.ts",
  "src/content/index.ts",
  "src/popup/index.ts",
  "src/options/index.ts",
];

// IIFE, never ESM: content scripts cannot be modules, and Firefox's event
// page cannot either. One format keeps both engines happy.
const shared = {
  bundle: true,
  format: "iife",
  target: ["chrome120", "firefox128"],
  // Unminified on purpose: AMO review asks for sources when code is minified.
  minify: false,
  sourcemap: true,
  logLevel: "info",
};

/** Render src/manifest.ts without a separate compile step. */
async function manifestFor(target) {
  // Per target: both builds run at once, and a shared path means one can import
  // the file while the other is still writing it.
  const tmp = join(root, `.tmp-manifest.${target}.mjs`);
  await esbuild.build({
    entryPoints: [join(root, "src/manifest.ts")],
    outfile: tmp,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  const { manifest } = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  await rm(tmp, { force: true });
  return manifest(target);
}

async function buildTarget(target) {
  const outdir = join(root, "dist", target);
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  const options = {
    ...shared,
    entryPoints,
    outdir,
    outbase: "src",
    define: { __TARGET__: JSON.stringify(target) },
  };
  const ctx = watch ? await esbuild.context(options) : null;
  if (ctx) await ctx.watch();
  else await esbuild.build(options);

  await cp(join(root, "icons"), join(outdir, "icons"), { recursive: true });
  for (const page of ["popup", "options"]) {
    await cp(join(root, `src/${page}/${page}.html`), join(outdir, `${page}/${page}.html`));
    await cp(join(root, `src/${page}/${page}.css`), join(outdir, `${page}/${page}.css`));
  }
  await writeFile(
    join(outdir, "manifest.json"),
    `${JSON.stringify(await manifestFor(target), null, 2)}\n`,
  );
}

await Promise.all(targets.map(buildTarget));
console.log(watch ? "watching…" : "built dist/chrome and dist/firefox");
