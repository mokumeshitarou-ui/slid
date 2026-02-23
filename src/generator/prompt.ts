import type { SlideDataPack } from "../schema/slide-data.js";

/**
 * Gemini API に渡すシステムプロンプトを構築する
 */
export function buildSystemPrompt(meta: SlideDataPack["meta"]): string {
  const themeDescriptions: Record<string, string> = {
    modern:
      "洗練されたモダンデザイン。グラデーション背景、サンセリフフォント、余白を活かしたレイアウト。アクセントカラーは鮮やかなブルー系。",
    minimal:
      "極限まで削ぎ落としたミニマルデザイン。白背景、黒テキスト、細いライン。タイポグラフィで魅せる。",
    corporate:
      "ビジネス向けの落ち着いたデザイン。ネイビー・グレー基調、明確な階層構造、データ表示に最適化。",
    creative:
      "クリエイティブで遊び心のあるデザイン。非対称レイアウト、太いフォント、ビビッドなカラーパレット。",
    pop: "ポップで親しみやすいデザイン。丸みのある要素、明るいカラー、手書き風フォントのアクセント。",
    dark: "ダークテーマ。深い黒背景、ネオンカラーのアクセント、高コントラスト。",
    nature:
      "自然をモチーフにしたデザイン。アースカラー、有機的な形状、セリフフォント。",
  };

  const themeDesc =
    themeDescriptions[meta.theme] ?? themeDescriptions["modern"];

  const viewport =
    meta.aspectRatio === "4:3"
      ? "width: 1024px, height: 768px"
      : "width: 1920px, height: 1080px";

  return `あなたはプロフェッショナルなスライドデザイナーです。
与えられたスライドデータをもとに、美しいHTML/CSSのスライドを生成してください。

## デザインテーマ
${themeDesc}

## 技術要件
- 各スライドは独立した完全なHTMLドキュメント（<!DOCTYPE html> から </html> まで）
- viewport: ${viewport}
- Google Fonts の読み込みは <link> タグで HTML 内に含める
- 外部画像は使わない（SVGインラインやCSS gradient で代替）
- アニメーションは不要（静止画としてキャプチャするため）
- 言語: ${meta.lang}
- フォントは日本語対応のものを選ぶこと（Noto Sans JP, M PLUS Rounded 1c, Zen Maru Gothic 等）

## デザインの多様性
同じテーマでも毎回少しずつ異なるデザインバリエーションを生成してください：
- カラーパレットのバリエーション
- レイアウトの微妙な変化
- フォントの組み合わせの工夫
- 装飾要素（ジオメトリックパターン、グラデーション、シャドウ）の変化

## 出力形式
JSON で以下の構造を返してください:
{
  "baseCss": "全スライド共通のリセットCSS・共通変数",
  "slides": [
    {
      "slideId": 1,
      "html": "完全なHTMLドキュメント文字列",
      "css": "このスライド固有のCSS"
    }
  ]
}`;
}

/**
 * スライドデータをユーザーメッセージとして整形する
 */
export function buildUserPrompt(data: SlideDataPack): string {
  return `以下のスライドデータからHTMLスライドを生成してください。

プレゼンテーションタイトル: ${data.meta.title}

スライドデータ:
${JSON.stringify(data.slides, null, 2)}`;
}
