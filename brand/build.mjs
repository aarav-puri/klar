// Rasterizes brand SVGs into the PNG sizes Chrome and browsers need.
// Usage: node brand/build.mjs
import sharp from "sharp";
import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const extIcons = join(root, "apps/extension/public/icons");
const webPublic = join(root, "apps/web/public");
const webApp = join(root, "apps/web/src/app");
mkdirSync(extIcons, { recursive: true });
mkdirSync(join(webPublic, "brand"), { recursive: true });

async function raster(src, size, out, padding = 0) {
  const inner = Math.round(size * (1 - padding * 2));
  const img = await sharp(join(here, src), { density: 1200 }).resize(inner, inner).png().toBuffer();
  const off = Math.round((size - inner) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, left: off, top: off }])
    .png()
    .toFile(out);
}

// Extension: 16px uses the small-size grid; larger sizes use the full symbol.
await raster("icon-small.svg", 16, join(extIcons, "icon-16.png"));
await raster("icon-small.svg", 32, join(extIcons, "icon-32.png"), 0.03);
await raster("symbol.svg", 48, join(extIcons, "icon-48.png"));
// Chrome Web Store guidance: ~96px artwork centered in a 128px canvas.
await raster("symbol.svg", 128, join(extIcons, "icon-128.png"), 0.06);
// Greyscale variant shown when the extension needs attention is handled with a badge instead.

await raster("icon-small.svg", 180, join(webApp, "apple-icon.png"), 0.12);
copyFileSync(join(here, "favicon.svg"), join(webApp, "icon.svg"));
for (const f of ["symbol.svg", "symbol-dark.svg", "symbol-mono.svg", "logo-light.svg", "logo-dark.svg", "wordmark.svg", "favicon.svg"]) {
  copyFileSync(join(here, f), join(webPublic, "brand", f));
}
console.log("brand assets written");
