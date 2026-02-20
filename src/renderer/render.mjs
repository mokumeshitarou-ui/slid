/**
 * Playwright レンダリングスクリプト
 *
 * Canvas出力（base.css + slide_*.html + slides_manifest.json）を
 * 1920x1080 PNG連番に変換し、ZIPにまとめる。
 *
 * 使い方:
 *   node src/renderer/render.mjs runs/noroma-hanten
 *
 * 入力ディレクトリ構成:
 *   runs/<shop>/html/
 *     base.css
 *     slide_001.html ... slide_NNN.html
 *     slides_manifest.json
 *
 * 出力:
 *   runs/<shop>/png/slide_001.png ... slide_NNN.png
 *   runs/<shop>/slides.zip
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

// ========== 設定 ==========
const WIDTH = 1920;
const HEIGHT = 1080;

// Chromium パス（環境に合わせて変更）
const CHROME_CANDIDATES = [
  "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Chromium が見つかりません。CHROME_PATH 環境変数で指定するか、playwright install chromium を実行してください。"
  );
}

// ========== 引数パース ==========
const runDir = process.argv[2];
if (!runDir) {
  console.error("使い方: node src/renderer/render.mjs <run-directory>");
  console.error("例:     node src/renderer/render.mjs runs/noroma-hanten");
  process.exit(1);
}

const runPath = resolve(runDir);
const htmlDir = join(runPath, "html");
const pngDir = join(runPath, "png");
const zipPath = join(runPath, "slides.zip");

// ========== バリデーション ==========
if (!existsSync(htmlDir)) {
  console.error(`エラー: html ディレクトリが見つかりません: ${htmlDir}`);
  process.exit(1);
}

const manifestPath = join(htmlDir, "slides_manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`エラー: slides_manifest.json が見つかりません: ${manifestPath}`);
  process.exit(1);
}

// ========== マニフェスト読み込み ==========
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const slides = manifest.slides;

if (!slides || slides.length === 0) {
  console.error("エラー: マニフェストにスライドが定義されていません");
  process.exit(1);
}

console.log(`=== スライドレンダリング ===`);
console.log(`店舗: ${manifest.shop_name || "(不明)"}`);
console.log(`スライド数: ${slides.length}`);
console.log(`入力: ${htmlDir}`);
console.log(`出力: ${pngDir}`);
console.log("");

// ========== PNG出力ディレクトリ作成 ==========
mkdirSync(pngDir, { recursive: true });

// ========== Playwright レンダリング ==========
const chromePath = process.env.CHROME_PATH || findChrome();
console.log(`Chromium: ${chromePath}`);

const browser = await chromium.launch({
  executablePath: chromePath,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});

const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});

const errors = [];

for (let i = 0; i < slides.length; i++) {
  const slide = slides[i];
  const htmlPath = join(htmlDir, slide.file);
  const num = String(i + 1).padStart(3, "0");
  const pngFile = `slide_${num}.png`;
  const pngPath = join(pngDir, pngFile);

  if (!existsSync(htmlPath)) {
    console.error(`  !! ${slide.file} が見つかりません、スキップ`);
    errors.push({ file: slide.file, error: "ファイル不在" });
    continue;
  }

  const page = await context.newPage();

  // file:// プロトコルで開く（base.css の相対パス解決のため）
  const fileUrl = `file://${htmlPath}`;
  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForTimeout(300); // フォント読み込み待機

  await page.screenshot({
    path: pngPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });

  await page.close();
  console.log(`  ${pngFile}  ← ${slide.file}  (${slide.title || slide.type})`);
}

await browser.close();

// ========== ZIP 作成 ==========
console.log("");
console.log("ZIP 作成中...");

// 既存ZIP削除
if (existsSync(zipPath)) {
  execSync(`rm "${zipPath}"`);
}

// png/ ディレクトリ内のPNGをZIP
execSync(`cd "${pngDir}" && zip -j "${zipPath}" slide_*.png`, {
  stdio: "pipe",
});

console.log(`ZIP: ${zipPath}`);

// ========== レポート ==========
console.log("");
console.log("=== 完了 ===");
console.log(`PNG: ${slides.length - errors.length}/${slides.length} 枚成功`);
if (errors.length > 0) {
  console.log(`エラー: ${errors.length} 件`);
  for (const e of errors) {
    console.log(`  - ${e.file}: ${e.error}`);
  }
}
console.log(`出力先: ${pngDir}/`);
console.log(`ZIP: ${zipPath}`);
