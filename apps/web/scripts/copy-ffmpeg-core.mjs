// Copies the single-thread ffmpeg.wasm core (fallback video transcoder) to public/ffmpeg/
// so it is served from our own origin (never from a third-party CDN).
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../public/ffmpeg");
const require = createRequire(import.meta.url);

let coreDir;
try {
  coreDir = path.resolve(path.dirname(require.resolve("@ffmpeg/core")), "..", "esm"); // resolves dist/umd → dist/esm
} catch {
  console.warn("[copy-ffmpeg-core] @ffmpeg/core not installed; skipping");
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });
for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  const src = path.join(coreDir, f);
  const dst = path.join(outDir, f);
  if (!existsSync(src)) {
    console.warn(`[copy-ffmpeg-core] missing ${src}`);
    continue;
  }
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  copyFileSync(src, dst);
}
// The @ffmpeg/ffmpeg module worker is served as static files too, so its dynamic `import(coreURL)`
// runs natively in the browser instead of being rewritten by webpack.
let workerDir;
try {
  workerDir = path.join(path.dirname(require.resolve("@ffmpeg/ffmpeg/worker")));
} catch {
  workerDir = null;
}
if (workerDir) for (const f of ["worker.js", "const.js", "errors.js"]) {
  const src = path.join(workerDir, f);
  if (existsSync(src)) copyFileSync(src, path.join(outDir, f));
}
console.log(`[copy-ffmpeg-core] core copied to ${path.relative(process.cwd(), outDir)}`);
