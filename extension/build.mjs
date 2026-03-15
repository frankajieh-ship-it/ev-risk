import { build, context } from "esbuild";
import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const isWatch = process.argv.includes("--watch");

const outdir = "dist";

/** Copy static assets (manifest, HTML, CSS, icons) to dist */
function copyStatic() {
  // Ensure output directories exist
  for (const dir of ["content", "popup", "icons", "background"]) {
    mkdirSync(join(outdir, dir), { recursive: true });
  }

  // manifest.json
  copyFileSync("manifest.json", join(outdir, "manifest.json"));

  // popup.html
  copyFileSync(join("popup", "popup.html"), join(outdir, "popup", "popup.html"));

  // content styles
  copyFileSync(join("content", "styles.css"), join(outdir, "content", "styles.css"));

  // icons
  if (existsSync("icons")) {
    for (const file of readdirSync("icons")) {
      if (file.endsWith(".png") || file.endsWith(".svg")) {
        copyFileSync(join("icons", file), join(outdir, "icons", file));
      }
    }
  }

  console.log("Static assets copied.");
}

const sharedConfig = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? "inline" : false,
  target: "chrome110",
  outdir,
};

async function main() {
  copyStatic();

  const entryPoints = [
    { in: "content/detector.ts", out: "content/detector" },
    { in: "content/badge.ts", out: "content/badge" },
    { in: "content/panel.ts", out: "content/panel" },
    { in: "background/service-worker.ts", out: "background/service-worker" },
    { in: "popup/popup.ts", out: "popup/popup" },
  ];

  if (isWatch) {
    const ctx = await context({
      ...sharedConfig,
      entryPoints: entryPoints.map((e) => ({ in: e.in, out: e.out })),
    });
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await build({
      ...sharedConfig,
      entryPoints: entryPoints.map((e) => ({ in: e.in, out: e.out })),
    });
    console.log("Build complete.");
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
