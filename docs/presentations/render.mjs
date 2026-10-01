#!/usr/bin/env node
// Renders one deck to HTML + PDF. Works the same on macOS, Linux and Windows:
//   node docs/presentations/render.mjs fall-2026
//   node docs/presentations/render.mjs fall-2026 --png /tmp/deck   (one image per slide)
// marp-cli comes from npx; set MARP_BIN to a local binary to skip the download.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [deck, ...rest] = process.argv.slice(2);

if (!deck) {
  console.error("usage: node render.mjs <deck-dir> [--png <out-dir>]");
  process.exit(2);
}

const source = join(deck, "slides.md");
if (!existsSync(join(here, source))) {
  console.error(`no ${source} in ${here}`);
  process.exit(2);
}

// The input path goes first: --theme-set takes a list and would swallow it.
const common = ["--html", "--allow-local-files", "--theme-set", "theme.css"];

const marp = (args) => {
  const bin = process.env.MARP_BIN;
  const [command, argv] = bin
    ? [bin, args]
    : [process.platform === "win32" ? "npx.cmd" : "npx", ["-y", "@marp-team/marp-cli@4", ...args]];
  const run = spawnSync(command, argv, { cwd: here, stdio: "inherit", shell: false });
  if (run.status !== 0) process.exit(run.status ?? 1);
};

const pngIndex = rest.indexOf("--png");
if (pngIndex !== -1) {
  const out = rest[pngIndex + 1];
  if (!out) {
    console.error("--png needs an output directory");
    process.exit(2);
  }
  marp([source, ...common, "--images", "png", "-o", join(out, "s.png")]);
  console.log(`rendered one PNG per slide into ${out}`);
} else {
  marp([source, ...common, "-o", join(deck, "slides.html")]);
  marp([source, ...common, "--pdf-notes", "-o", join(deck, "slides.pdf")]);
  console.log(`rendered ${deck}/slides.html and ${deck}/slides.pdf`);
}
