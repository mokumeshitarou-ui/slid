import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createWriteStream } from "node:fs";
import archiver from "archiver";
import { SlideDataPackSchema } from "./schema/slide-data.js";
import { generateSlides } from "./generator/gemini.js";
import { renderSlides } from "./renderer/playwright.js";

// --- CLI 引数パース ---

function parseArgs(): { inputPath: string; outputDir: string; model?: string } {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const outputDir =
    args.find((a) => a.startsWith("--output-dir="))?.split("=")[1] ??
    "./output";
  const model = args.find((a) => a.startsWith("--model="))?.split("=")[1];

  if (!inputPath) {
    console.error("Usage: npx tsx src/pipeline.ts <input.json> [--output-dir=./output] [--model=gemini-2.5-pro]");
    process.exit(1);
  }

  return { inputPath: resolve(inputPath), outputDir: resolve(outputDir), model };
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
      const name = pngPath.split("/").pop()!;
      archive.file(pngPath, { name });
    }

    archive.finalize();
  });
}

// --- メインパイプライン ---

async function main() {
  const { inputPath, outputDir, model } = parseArgs();

  // 1. 入力ファイル読み込み & バリデーション
  console.log(`\n[pipeline] Reading input: ${inputPath}`);
  const raw = await readFile(inputPath, "utf-8");
  const parsed = JSON.parse(raw);
  const data = SlideDataPackSchema.parse(parsed);
  console.log(`[pipeline] Validated: "${data.meta.title}" (${data.slides.length} slides, theme: ${data.meta.theme})`);

  // 2. Gemini API で HTML/CSS 生成
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    console.error("[pipeline] Error: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log("\n[pipeline] === Phase 1: Generate HTML/CSS ===");
  const generated = await generateSlides(data, { apiKey, model });

  // 3. Playwright で PNG レンダリング
  console.log("\n[pipeline] === Phase 2: Render to PNG ===");
  const viewport =
    data.meta.aspectRatio === "4:3"
      ? { width: 1024, height: 768 }
      : { width: 1920, height: 1080 };

  const pngPaths = await renderSlides(generated, {
    outputDir,
    ...viewport,
  });

  // 4. ZIP 圧縮
  console.log("\n[pipeline] === Phase 3: Create ZIP ===");
  const zipPath = await createZip(pngPaths, outputDir);

  // 完了
  console.log(`\n[pipeline] Done!`);
  console.log(`  PNG files: ${pngPaths.length}`);
  console.log(`  ZIP: ${zipPath}`);
  console.log(`  Output dir: ${outputDir}`);
}

main().catch((err) => {
  console.error("[pipeline] Fatal error:", err);
  process.exit(1);
});
