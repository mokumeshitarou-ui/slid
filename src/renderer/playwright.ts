import { chromium, type Browser, type Page } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { GeneratedSlides } from "../schema/gemini-output.js";

export interface RenderOptions {
  outputDir: string;
  width?: number;
  height?: number;
}

/**
 * 1スライド分のHTMLにベースCSSを注入した完全なHTMLを組み立てる
 */
function assembleHtml(
  slideHtml: string,
  slideCss: string,
  baseCss: string
): string {
  // <head> 内に baseCss + slideCss を <style> タグとして注入
  const styleTag = `<style>\n${baseCss}\n${slideCss}\n</style>`;

  // </head> の直前に挿入。</head> がなければ末尾に追加
  if (slideHtml.includes("</head>")) {
    return slideHtml.replace("</head>", `${styleTag}\n</head>`);
  }
  // <head> がなければ DOCTYPE 後に挿入
  return slideHtml.replace(
    /(<html[^>]*>)/i,
    `$1\n<head>${styleTag}</head>`
  );
}

/**
 * 生成されたスライド群を Playwright で PNG にレンダリングする
 */
export async function renderSlides(
  generated: GeneratedSlides,
  options: RenderOptions
): Promise<string[]> {
  const { outputDir, width = 1920, height = 1080 } = options;

  await mkdir(outputDir, { recursive: true });
  await mkdir(join(outputDir, "html"), { recursive: true });

  const outputPaths: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2, // Retina品質
    });

    for (const slide of generated.slides) {
      const paddedId = String(slide.slideId).padStart(3, "0");
      const htmlPath = join(outputDir, "html", `slide_${paddedId}.html`);
      const pngPath = join(outputDir, `slide_${paddedId}.png`);

      // HTML ファイルを書き出し
      const fullHtml = assembleHtml(
        slide.html,
        slide.css,
        generated.baseCss
      );
      await writeFile(htmlPath, fullHtml, "utf-8");

      // Playwright でスクリーンショット
      const page: Page = await context.newPage();
      try {
        await page.goto(`file://${htmlPath}`, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });

        // Google Fonts の読み込み待ち
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: pngPath,
          type: "png",
          fullPage: false,
        });

        outputPaths.push(pngPath);
        console.log(`[renderer] slide_${paddedId}.png`);
      } finally {
        await page.close();
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return outputPaths;
}
