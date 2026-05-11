/**
 * Generates square PWA / favicon assets from `design-assets/tiaki-icon-source.png`.
 * Source may be a wide screenshot — we center-crop the largest square, then resize.
 * Run: node scripts/generate-app-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "design-assets", "tiaki-icon-source.png");

async function main() {
  if (!fs.existsSync(srcPath)) {
    console.error("[generate-app-icons] Missing:", srcPath);
    process.exit(1);
  }

  const meta = await sharp(srcPath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2);
  const top = Math.floor((h - side) / 2);

  const iconsDir = path.join(root, "public", "icons");
  await fs.promises.mkdir(iconsDir, { recursive: true });

  const crop = {
    left,
    top,
    width: side,
    height: side,
  };

  const sq = () => sharp(srcPath).extract(crop);

  await sq()
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "app-icon-512.png"));

  await sq()
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, "app-icon-192.png"));

  await sq()
    .resize(512, 512)
    .png()
    .toFile(path.join(root, "src", "app", "icon.png"));

  await sq()
    .resize(180, 180)
    .png()
    .toFile(path.join(root, "src", "app", "apple-icon.png"));

  console.log(
    `[generate-app-icons] OK — crop ${side}² @ (${left},${top}) from ${w}×${h}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
