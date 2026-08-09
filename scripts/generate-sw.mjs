/**
 * Generates out/sw.js after `next build`.
 *
 * Uses workbox-build (a Node CLI — no webpack coupling) to scan the static
 * export and inject a revisioned precache manifest into scripts/sw-template.js.
 * The build SHA (CF_PAGES_COMMIT_SHA on Cloudflare Pages, git HEAD locally,
 * or a timestamp) is baked in so every deploy produces a fresh sw.js and cache.
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { injectManifest } from "workbox-build";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "out");

function resolveSha() {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA;
  try {
    const sha = execSync("git rev-parse HEAD", { cwd: ROOT })
      .toString()
      .trim();
    if (sha) return sha;
  } catch {}
  return String(Date.now());
}

if (!existsSync(OUT_DIR)) {
  console.error("[sw] out/ not found — run `next build` first.");
  process.exit(1);
}

const sha = resolveSha();

const swPath = resolve(OUT_DIR, "sw.js");
const tempSwPath = join(tmpdir(), `jaaw-sw-template-${process.pid}.js`);

try {
  const bundle = await rollup({
    input: resolve(ROOT, "scripts", "sw-template.js"),
    plugins: [
      nodeResolve(),
      replace({
        preventAssignment: true,
        values: {
          "process.env.NODE_ENV": JSON.stringify("production"),
        },
      }),
    ],
    onwarn() {},
  });
  const { output } = await bundle.generate({ format: "iife" });
  writeFileSync(tempSwPath, output[0].code);
  await bundle.close();

  const { count, size } = await injectManifest({
    swSrc: tempSwPath,
    swDest: swPath,
    globDirectory: OUT_DIR,
    globPatterns: [
      "**/*.{html,js,css,ttf,otf,woff,woff2,png,svg,ico,jpg,jpeg,webp,avif,json,txt}",
    ],
    globIgnores: [
      "sw.js",
      "_headers",
      "_redirects",
      "config.json",
      "**/__next._full.txt",
      "**/__next._tree.txt",
    ],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  });

  const sw = readFileSync(swPath, "utf8").replaceAll("__BUILD_SHA__", sha);
  writeFileSync(swPath, sw);

  console.log(`[sw] generated ${swPath}`);
  console.log(`[sw] build sha: ${sha}`);
  console.log(`[sw] precached ${count} files (${(size / 1024).toFixed(1)} KiB)`);
} finally {
  rmSync(tempSwPath, { force: true });
}
