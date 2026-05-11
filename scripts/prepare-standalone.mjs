/**
 * After `next build` with `output: "standalone"`, Next expects `public` and
 * `.next/static` copied beside `server.js`. Run: `node scripts/prepare-standalone.mjs`
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  if (!fs.existsSync(standalone)) {
    console.warn(
      "[prepare-standalone] No .next/standalone — run `npm run build` first.",
    );
    process.exit(0);
  }

  const pubSrc = path.join(root, "public");
  const pubDest = path.join(standalone, "public");
  if (fs.existsSync(pubSrc)) {
    copyRecursive(pubSrc, pubDest);
    console.log("[prepare-standalone] Copied public/ → .next/standalone/public/");
  }

  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standalone, ".next", "static");
  if (fs.existsSync(staticSrc)) {
    copyRecursive(staticSrc, staticDest);
    console.log(
      "[prepare-standalone] Copied .next/static → .next/standalone/.next/static/",
    );
  }

  console.log("[prepare-standalone] Ready for `npm run start:standalone`");
}

main();
