/**
 * Replaces __DEPLOY_ID__ in public/sw.js with the current git commit hash
 * (or the COMMIT_REF env var that Netlify injects at build time).
 *
 * Run as part of the build: "node scripts/inject-sw-version.mjs && next build"
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, "../public/sw.js");

// Netlify sets COMMIT_REF; fall back to git rev-parse for local builds
const deployId =
  process.env.COMMIT_REF?.slice(0, 8) ||
  execSync("git rev-parse --short HEAD").toString().trim();

const original = readFileSync(swPath, "utf8");
const replaced = original.replace(/__DEPLOY_ID__/g, deployId);
writeFileSync(swPath, replaced, "utf8");

console.log(`[inject-sw-version] CACHE = offo-${deployId}`);
