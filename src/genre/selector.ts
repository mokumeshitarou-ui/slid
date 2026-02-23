import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { InputPack } from "../schema/input-pack.js";
import {
  GenreIdSchema,
  GenreResultSchema,
  type GenreResult,
  type GenreCandidate,
} from "../schema/genre.js";

// --- Gemini に返させる JSON スキーマ ---

const GenreCandidatesResponseSchema = z.object({
  candidates: z.array(z.object({
    genre: GenreIdSchema,
    subtypes: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string()),
  })).min(1).max(3),
});

// --- プロンプト構築 ---

function buildGenreSelectorPrompt(input: InputPack): { system: string; user: string } {
  const system = `あなたは飲食店ジャンル判定の専門家です。
店名とメニュー構成から、以下9ジャンルのうち最も適切な候補を3つ選んでください。

## ジャンル一覧（ID と代表的な特徴）
- machichuuka（町中華）: 中華料理全般、チャーハン・餃子・麻婆豆腐が主力
- ramen（ラーメン）: ラーメン専門、麺類が主力
- kaisen（海鮮・寿司）: 刺身・寿司・海鮮丼が主力
- yakiniku（焼肉・ホルモン）: 焼肉・ホルモン・カルビが主力
- izakaya（居酒屋）: 酒類+おつまみ中心、多ジャンル
- soba（そば）: そば専門・そば+丼セット
- udon（うどん）: うどん専門・うどん+丼セット
- teishoku（定食屋）: 定食中心、日替わり、ご飯+おかず+汁物
- bento（弁当屋）: 持ち帰り弁当、テイクアウト中心

## サブタイプ（該当するものがあれば付与）
- ramen: shoyu / shio / miso / tonkotsu / gyokai / jiro / iekei / tantan / tsukemen
- teishoku: family / workers / junk / healthy / teishoku_sake
- soba: standing / oldshop / modern / heavy
- udon: standing / oldshop / modern / heavy
- bento: budget / karaage / healthy / gourmet
- izakaya: standard / neo / standing
- yakiniku: standard / hormone / luxury
- kaisen: sushi / kaisendon / robata

## 判定基準
1. 店名のキーワード（「飯店」→ 町中華、「ラーメン」→ ラーメン等）
2. メニューのカテゴリ構成（「麺類」が主力なら ramen or machichuuka）
3. メニュー品数の比率（焼肉メニューが8割なら yakiniku）
4. 価格帯と品揃えの幅

## 出力形式
JSON で以下の構造を返してください:
{
  "candidates": [
    {
      "genre": "ジャンルID",
      "subtypes": ["サブタイプ"],
      "confidence": 0.85,
      "reasons": ["理由1", "理由2"]
    }
  ]
}

候補は confidence が高い順に最大3つ。confidence は 0.0〜1.0。
reasons は日本語で、具体的な根拠を書いてください。`;

  // ユーザーメッセージ: 店名 + カテゴリ構成の要約
  const categorySummary = input.menu.categories
    .map(c => {
      const itemCount = c.items.length;
      const sampleItems = c.items.slice(0, 3).map(i => i.name).join("、");
      const ellipsis = itemCount > 3 ? ` 他${itemCount - 3}品` : "";
      return `- ${c.category_name}（${itemCount}品）: ${sampleItems}${ellipsis}`;
    })
    .join("\n");

  const user = `以下の飲食店のジャンルを判定してください。

店名: ${input.shop.name}
エリア: ${input.shop.area ?? "不明"}
カテゴリ構成:
${categorySummary}

税表示: ${input.menu.tax}
合計品数: ${input.menu.categories.reduce((sum, c) => sum + c.items.length, 0)}品`;

  return { system, user };
}

// --- API呼び出し ---

export interface GenreSelectorOptions {
  apiKey: string;
  model?: string;
}

/**
 * Gemini API でジャンル候補を取得する。
 * ユーザー確定は呼び出し側（CLI等）で行い、GenreResult を完成させる。
 */
export async function selectGenreCandidates(
  input: InputPack,
  options: GenreSelectorOptions,
): Promise<GenreCandidate[]> {
  // genre_hint がある場合は AI 判定をスキップ
  if (input.genre_hint) {
    const parsed = GenreIdSchema.safeParse(input.genre_hint);
    if (parsed.success) {
      return [{
        genre: parsed.data,
        subtypes: [],
        confidence: 1.0,
        reasons: ["genre_hint による事前指定"],
      }];
    }
    // genre_hint が不正な場合はフォールスルーして AI 判定
  }

  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const { system, user } = buildGenreSelectorPrompt(input);

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
    throw new Error("GenreSelector: Gemini API returned empty response");
  }

  const parsed = JSON.parse(text);
  const result = GenreCandidatesResponseSchema.parse(parsed);

  // confidence 降順でソート
  return result.candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * genre_hint から直接 GenreResult を生成（AI 判定スキップ）
 */
export function genreResultFromHint(genreHint: string): GenreResult {
  const genre = GenreIdSchema.parse(genreHint);
  return {
    candidates: [{
      genre,
      subtypes: [],
      confidence: 1.0,
      reasons: ["genre_hint による事前指定"],
    }],
    selected: {
      genre,
      subtypes: [],
      selected_by: "hint",
    },
  };
}
