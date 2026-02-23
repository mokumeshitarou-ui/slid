import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ThemeTokensSchema, type ThemeTokens } from "../schema/theme-tokens.js";
import type { GenreResult } from "../schema/genre.js";
import { PALETTES } from "./palettes.js";

// --- Gemini に返させる JSON スキーマ ---

const ThemeGeneratorResponseSchema = z.object({
  variants: z.array(ThemeTokensSchema).min(3).max(5),
});

// --- プロンプト構築 ---

function buildThemeGeneratorPrompt(
  genreResult: GenreResult,
  shopName: string,
  variantCount: number,
): { system: string; user: string } {
  const genre = genreResult.selected.genre;
  const subtypes = genreResult.selected.subtypes;
  const palette = PALETTES[genre];

  const system = `あなたは飲食店メニュースライドのデザイントークン生成の専門家です。
指定されたジャンルの許可パレット範囲内で、${variantCount}案のデザインバリエーションを生成してください。

## 設計思想
「構造は固定、表情だけ変える」
- 固定（変えない）: フォントサイズ、グリッド、安全領域、行数上限、分割規則
- 変える（あなたが決める）: 色、帯の形、行の区切り方、角丸、抽象パターン

## ThemeTokens スキーマ
{
  "variant_id": number (1〜${variantCount}),
  "variant_label": string （例: "町中華・赤看板"、日本語で雰囲気を表す短い名前）,
  "colors": {
    "bg": "#RRGGBB"       // 背景色
    "fg": "#RRGGBB"       // 文字色
    "accent": "#RRGGBB"   // アクセント1色
    "accent_fg": "#RRGGBB" // アクセント上の文字色
    "muted": "#RRGGBB"    // 補助色（注記・ページ番号用）
  },
  "header_style": "solid" | "outline" | "thick_line" | "block",
  "row_style": "alternating" | "band" | "thick_line" | "none",
  "radius": 0 | 8 | 12 | 16 | 20,
  "pattern": "none" | "dots" | "grain" | "stripes",
  "pattern_opacity": 0.02〜0.08,
  "density": "tight" | "normal"
}

## 色のルール
- bg と fg のコントラスト比は WCAG AA 以上（4.5:1）を保証すること
- accent_fg は accent 色の上に載るテキスト色。十分なコントラストを確保
- muted は fg より薄い色（補助情報用）
- pattern_opacity は 0.02〜0.08（背景に溶け込む程度）

## 多様性のルール
- ${variantCount}案は互いに明確に違うこと（明暗・寒暖・帯スタイルを変える）
- 全案が暗背景や全案が同じ accent にならないこと
- 最低1案は明るい背景、最低1案は暗い背景を含めること（3案以上の場合）

## 出力形式
JSON で以下の構造を返してください:
{
  "variants": [
    { ...ThemeTokens },
    { ...ThemeTokens },
    ...
  ]
}`;

  const paletteDesc = palette
    ? `許可パレット:
  bg: ${JSON.stringify(palette.bg)}
  accent: ${JSON.stringify(palette.accent)}
  header: ${JSON.stringify(palette.header)}
  row: ${JSON.stringify(palette.row)}
  pattern: ${JSON.stringify(palette.pattern)}
  density: ${JSON.stringify(palette.density)}`
    : "（許可パレット未定義。ジャンルの一般的な雰囲気から判断してください）";

  const user = `以下の飲食店向けにデザイントークンを${variantCount}案生成してください。

店名: ${shopName}
ジャンル: ${genre}
サブタイプ: ${subtypes.length > 0 ? subtypes.join(", ") : "なし"}

${paletteDesc}`;

  return { system, user };
}

// --- API呼び出し ---

export interface ThemeGeneratorOptions {
  apiKey: string;
  model?: string;
  variantCount?: number;
}

/**
 * Gemini API でデザイントークン案を生成する。
 */
export async function generateThemeVariants(
  genreResult: GenreResult,
  shopName: string,
  options: ThemeGeneratorOptions,
): Promise<ThemeTokens[]> {
  const variantCount = options.variantCount ?? 3;
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const { system, user } = buildThemeGeneratorPrompt(genreResult, shopName, variantCount);

  const response = await ai.models.generateContent({
    model: options.model ?? "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("ThemeGenerator: Gemini API returned empty response");
  }

  const parsed = JSON.parse(text);
  const result = ThemeGeneratorResponseSchema.parse(parsed);

  return result.variants;
}
