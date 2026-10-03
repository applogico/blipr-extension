// Upload dist/blipr-chrome.zip to the Chrome Web Store and submit it for review.
// Runs from semantic-release's publish step; a missing credential skips the
// upload with a note instead of failing the release.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const needed = ["PUBLISHER_ID", "EXTENSION_ID", "CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"];
const missing = needed.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.log(`Chrome Web Store upload skipped: ${missing.join(", ")} not set.`);
  process.exit(0);
}
if (!existsSync("dist/blipr-chrome.zip")) {
  console.error("dist/blipr-chrome.zip is missing; run `npm run package` first.");
  process.exit(1);
}
const result = spawnSync(
  "npx",
  // No command uploads and submits for review; `upload` alone leaves a draft.
  ["chrome-webstore-upload", "--source", "dist/blipr-chrome.zip"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
