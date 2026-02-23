import { z } from "zod";

/**
 * Gemini API が返す1スライド分のHTML/CSS
 * structured output (JSON mode) で受け取る
 */
export const SlideHtmlOutputSchema = z.object({
  slideId: z.number().int().positive().describe("スライドID"),
  html: z.string().describe("完全なHTML文字列（<!DOCTYPE html> から </html> まで）"),
  css: z.string().describe("インラインではない外部CSSとして適用されるスタイル"),
});

/**
 * Gemini API が返す全スライド分の出力
 */
export const GeneratedSlidesSchema = z.object({
  baseCss: z
    .string()
    .describe("全スライド共通のベースCSS（リセット、フォント、共通変数）"),
  slides: z.array(SlideHtmlOutputSchema).min(1),
});

// --- 型エクスポート ---

export type SlideHtmlOutput = z.infer<typeof SlideHtmlOutputSchema>;
export type GeneratedSlides = z.infer<typeof GeneratedSlidesSchema>;
