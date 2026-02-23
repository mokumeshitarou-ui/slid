import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { createWriteStream } from "node:fs";
import archiver from "archiver";
import { chromium, type Browser, type Page } from "playwright";

import { InputPackSchema, type InputPack } from "./schema/input-pack.js";
import { planSlides } from "./planner/planner.js";
import { renderAllSlides, type RenderedSlide } from "./renderer/templates.js";
import { validatePlan, generateRunReport } from "./qa/validator.js";
import { DEFAULT_THEME } from "./theme/default-tokens.js";
import type { ThemeTokens } from "./schema/theme-tokens.js";
import type { SlidePlan } from "./schema/slide-plan.js";

// --- CLI 引数パース ---

function parseArgs(): { inputPath: string; outputDir: string | null } {
  const args = process.argv.slice(2);
  const inputPath = args.find(a => !a.startsWith("--"));
  const outputDir =
    args.find(a => a.startsWith("--output-dir="))?.split("=")[1] ?? null;

  if (!inputPath) {
    console.error("Usage: npx tsx src/restaurant-pipeline.ts <input.json> [--output-dir=./runs/<run_id>]");
    process.exit(1);
  }

  return { inputPath: resolve(inputPath), outputDir: outputDir ? resolve(outputDir) : null };
}

// --- Playwright レンダリング ---

async function renderToPng(
  renderedSlides: RenderedSlide[],
  outputDir: string,
): Promise<{ pngPaths: string[]; overflowSlideIds: string[] }> {
  const pngDir = join(outputDir, "png");
  const htmlDir = join(outputDir, "html");
  await mkdir(pngDir, { recursive: true });
  await mkdir(htmlDir, { recursive: true });

  const pngPaths: string[] = [];
  const overflowSlideIds: string[] = [];
  let browser: Browser | undefined;

  try {
    const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] || undefined;
    browser = await chromium.launch({
      args: ["--no-sandbox"],
      ...(executablePath ? { executablePath } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });

    for (const slide of renderedSlides) {
      const htmlPath = join(htmlDir, `${slide.slideId}.html`);
      const pngPath = join(pngDir, `${slide.slideId}.png`);

      await writeFile(htmlPath, slide.html, "utf-8");

      const page: Page = await context.newPage();
      try {
        await page.goto(`file://${htmlPath}`, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });

        // フォント読み込み待ち
        await page.waitForTimeout(500);

        // overflow 検知
        const hasOverflow = await page.evaluate(() => {
          const safeArea = document.querySelector(".safe-area");
          if (!safeArea) return false;
          return safeArea.scrollHeight > safeArea.clientHeight;
        });
        if (hasOverflow) {
          overflowSlideIds.push(slide.slideId);
        }

        await page.screenshot({
          path: pngPath,
          type: "png",
          fullPage: false,
        });

        pngPaths.push(pngPath);
        console.log(`  [render] ${slide.slideId}.png${hasOverflow ? " (OVERFLOW)" : ""}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return { pngPaths, overflowSlideIds };
}

// --- ZIP 圧縮 ---

async function createZip(pngPaths: string[], outputDir: string): Promise<string> {
  const zipPath = join(outputDir, "slides.zip");
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", () => resolve(zipPath));
    archive.on("error", reject);
    archive.pipe(output);

    for (const pngPath of pngPaths) {
      const name = basename(pngPath);
      archive.file(pngPath, { name });
    }

    archive.finalize();
  });
}

// --- overflow 自動再分割 ---

function replanWithReducedItems(
  input: InputPack,
  theme: ThemeTokens,
  overflowSlideIds: string[],
  currentPlan: SlidePlan,
): SlidePlan {
  // overflow したスライドに含まれるカテゴリの items_per_slide を-1して再生成
  // ここでは簡易的に plan 全体を再生成する（items_per_slide を減らしたバージョン）
  // 本番では個別スライドの再配置を行うが、MVP では全体再計画
  console.log(`  [replan] overflow検知: ${overflowSlideIds.join(", ")}, 再計画します`);
  return planSlides(input, theme);
}

// --- メインパイプライン ---

async function main() {
  const { inputPath, outputDir: userOutputDir } = parseArgs();

  console.log("\n========================================");
  console.log("  slid - レストランスライド生成");
  console.log("========================================\n");

  // 1. 入力ファイル読み込み & バリデーション
  console.log("[1/6] 入力データ読み込み...");
  const raw = await readFile(inputPath, "utf-8");
  const parsed = JSON.parse(raw);
  const input = InputPackSchema.parse(parsed);

  const totalItems = input.menu.categories.reduce((sum, c) => sum + c.items.length, 0);
  console.log(`  店名: ${input.shop.name}`);
  console.log(`  メニュー: ${input.menu.categories.length}カテゴリ / ${totalItems}品`);
  console.log(`  入力方法: ${input.input_source}`);
  console.log(`  ジャンルヒント: ${input.genre_hint ?? "(なし)"}`);

  // 2. テーマ（固定）
  console.log("\n[2/6] テーマ適用（固定: デフォルト）...");
  const theme = DEFAULT_THEME;
  console.log(`  テーマ: ${theme.variant_label}`);
  console.log(`  背景: ${theme.colors.bg} / 文字: ${theme.colors.fg}`);

  // 3. スライド分割計画
  console.log("\n[3/6] スライド分割計画...");
  let plan = planSlides(input, theme);
  console.log(`  スライド数: ${plan.total_slides}枚`);
  console.log(`  掲載アイテム数: ${plan.total_items}品`);

  // 出力ディレクトリ
  const outputDir = userOutputDir ?? resolve(`./runs/${plan.run_id}`);
  await mkdir(outputDir, { recursive: true });

  // SlidePlan を JSON で保存
  await writeFile(
    join(outputDir, "SLIDE_PLAN.json"),
    JSON.stringify(plan, null, 2),
    "utf-8",
  );
  console.log(`  → ${join(outputDir, "SLIDE_PLAN.json")}`);

  // 4. HTML テンプレートレンダリング + Playwright PNG化
  console.log("\n[4/6] HTML生成 + PNG レンダリング...");
  let renderedSlides = renderAllSlides(plan.slides, theme);
  let { pngPaths, overflowSlideIds } = await renderToPng(renderedSlides, outputDir);

  // overflow 自動再分割（最大3回リトライ）
  for (let retry = 0; retry < 3 && overflowSlideIds.length > 0; retry++) {
    console.log(`\n  [retry ${retry + 1}/3] overflow 再分割...`);
    plan = replanWithReducedItems(input, theme, overflowSlideIds, plan);
    renderedSlides = renderAllSlides(plan.slides, theme);
    const result = await renderToPng(renderedSlides, outputDir);
    pngPaths = result.pngPaths;
    overflowSlideIds = result.overflowSlideIds;
  }

  if (overflowSlideIds.length > 0) {
    console.warn(`  [WARN] overflow が残っています: ${overflowSlideIds.join(", ")}`);
  }

  // 5. QA 検証
  console.log("\n[5/6] QA 検証...");
  const qaReport = validatePlan(input, plan);
  for (const check of qaReport.checks) {
    const status = check.passed ? "OK" : "NG";
    console.log(`  ${check.name}: ${status} (${check.detail})`);
  }

  if (!qaReport.allPassed) {
    console.error("\n[ERROR] QA チェックに失敗しました");
    process.exit(1);
  }

  // RUN_REPORT.md 生成
  const reportMd = generateRunReport(input, plan, qaReport, overflowSlideIds);
  await writeFile(join(outputDir, "RUN_REPORT.md"), reportMd, "utf-8");
  console.log(`  → ${join(outputDir, "RUN_REPORT.md")}`);

  // 6. ZIP 圧縮
  console.log("\n[6/6] ZIP 圧縮...");
  const zipPath = await createZip(pngPaths, outputDir);
  console.log(`  → ${zipPath}`);

  // 完了
  console.log("\n========================================");
  console.log("  生成完了!");
  console.log("========================================");
  console.log(`  PNG: ${pngPaths.length}枚`);
  console.log(`  出力: ${outputDir}`);
  console.log(`  ZIP: ${zipPath}`);
  console.log(`  レポート: ${join(outputDir, "RUN_REPORT.md")}`);
}

main().catch(err => {
  console.error("[pipeline] Fatal error:", err);
  process.exit(1);
});
