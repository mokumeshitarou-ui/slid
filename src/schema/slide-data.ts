import { z } from "zod";

// --- スライドコンテンツの型定義 ---

/** タイトルスライド */
export const TitleSlideContentSchema = z.object({
  title: z.string().describe("メインタイトル"),
  subtitle: z.string().optional().describe("サブタイトル"),
  author: z.string().optional().describe("著者名"),
  date: z.string().optional().describe("日付"),
});

/** コンテンツスライド（本文 + 箇条書き） */
export const ContentSlideContentSchema = z.object({
  title: z.string().describe("セクションタイトル"),
  body: z.string().optional().describe("本文テキスト"),
  bullets: z.array(z.string()).optional().describe("箇条書きリスト"),
});

/** 画像スライド */
export const ImageSlideContentSchema = z.object({
  title: z.string().describe("セクションタイトル"),
  imageUrl: z.string().describe("画像URL or Base64"),
  caption: z.string().optional().describe("キャプション"),
});

/** 2カラムスライド */
export const TwoColumnSlideContentSchema = z.object({
  title: z.string().describe("セクションタイトル"),
  left: z.object({
    heading: z.string().optional(),
    body: z.string().optional(),
    bullets: z.array(z.string()).optional(),
  }),
  right: z.object({
    heading: z.string().optional(),
    body: z.string().optional(),
    bullets: z.array(z.string()).optional(),
  }),
});

/** 引用スライド */
export const QuoteSlideContentSchema = z.object({
  quote: z.string().describe("引用テキスト"),
  attribution: z.string().optional().describe("引用元"),
});

/** エンディングスライド */
export const EndSlideContentSchema = z.object({
  title: z.string().describe("締めの言葉"),
  body: z.string().optional().describe("補足テキスト"),
  contactInfo: z.string().optional().describe("連絡先"),
});

// --- スライド型 ---

export const SlideTypeSchema = z.enum([
  "title",
  "content",
  "image",
  "two-column",
  "quote",
  "end",
]);

export const SlideSchema = z.object({
  id: z.number().int().positive(),
  type: SlideTypeSchema,
  content: z.union([
    TitleSlideContentSchema,
    ContentSlideContentSchema,
    ImageSlideContentSchema,
    TwoColumnSlideContentSchema,
    QuoteSlideContentSchema,
    EndSlideContentSchema,
  ]),
  notes: z.string().optional().describe("スピーカーノート"),
});

// --- メタデータ ---

export const ThemeSchema = z.enum([
  "modern",
  "minimal",
  "corporate",
  "creative",
  "pop",
  "dark",
  "nature",
]);

export const MetaSchema = z.object({
  title: z.string(),
  theme: ThemeSchema.default("modern"),
  lang: z.string().default("ja"),
  aspectRatio: z
    .enum(["16:9", "4:3"])
    .default("16:9")
    .describe("スライドのアスペクト比"),
});

// --- ルートスキーマ ---

export const SlideDataPackSchema = z.object({
  meta: MetaSchema,
  slides: z.array(SlideSchema).min(1),
});

// --- 型エクスポート ---

export type SlideDataPack = z.infer<typeof SlideDataPackSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type SlideType = z.infer<typeof SlideTypeSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Meta = z.infer<typeof MetaSchema>;
