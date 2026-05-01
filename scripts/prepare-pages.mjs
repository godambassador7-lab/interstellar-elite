import fs from "node:fs";
import path from "node:path";

const repoBase = "/interstellar-elite";
const distDir = path.resolve("dist");
const tiledUniverseSrc = path.resolve("no_blur_universe_system_png_fixed", "assets", "universe");
const tiledUniverseDest = path.join(distDir, "assets", "universe");

if (!fs.existsSync(distDir)) {
  console.error("dist directory not found. Run Expo export first.");
  process.exit(1);
}

if (fs.existsSync(tiledUniverseSrc)) {
  fs.mkdirSync(path.dirname(tiledUniverseDest), { recursive: true });
  fs.cpSync(tiledUniverseSrc, tiledUniverseDest, { recursive: true, force: true });
}

const rewriteRootRelativePaths = (content) =>
  content.replace(/(["'])\/(assets|_expo)\//g, `$1${repoBase}/$2/`);

const indexPath = path.join(distDir, "index.html");
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, "utf8");
  fs.writeFileSync(indexPath, rewriteRootRelativePaths(html), "utf8");
}

const webJsDir = path.join(distDir, "_expo", "static", "js", "web");
if (fs.existsSync(webJsDir)) {
  for (const file of fs.readdirSync(webJsDir)) {
    if (!file.endsWith(".js")) continue;
    const filePath = path.join(webJsDir, file);
    const js = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, rewriteRootRelativePaths(js), "utf8");
  }
}

console.log("Rewrote asset paths for GitHub Pages base:", repoBase);
