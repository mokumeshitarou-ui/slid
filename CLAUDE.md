# slid — AI-Driven Slide Generator

## プロジェクト概要

`slid` は、構造化されたスライドデータ（JSON）を入力として受け取り、Gemini API で HTML/CSS を動的生成し、Playwright でスクリーンショット（PNG）に変換するスライド生成パイプラインです。

## アーキテクチャ

```
input.json → Gemini API (HTML/CSS生成) → .html ファイル群 → Playwright (screenshot) → .png ファイル群 → slides.zip
```

### コアコンポーネント

| ディレクトリ | 役割 |
|-------------|------|
| `src/schema/` | Zod スキーマ定義（入力データ・Gemini出力） |
| `src/generator/` | Gemini API 連携（HTML/CSS 生成） |
| `src/renderer/` | Playwright レンダラー（HTML → PNG） |
| `src/pipeline.ts` | メインパイプライン（全体オーケストレーション） |

## 技術スタック

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **AI**: Google Gemini API (`@google/genai`)
- **Rendering**: Playwright (`playwright`)
- **Validation**: Zod
- **Bundler**: tsx (実行時)

## コマンド

```bash
# 依存インストール
npm install

# Playwright ブラウザインストール
npx playwright install chromium

# パイプライン実行
npx tsx src/pipeline.ts <input.json> [--output-dir ./output]

# 型チェック
npx tsc --noEmit
```

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GEMINI_API_KEY` | Yes | Google Gemini API キー |

## 設計原則

1. **デザインのランダム性**: テンプレートHTMLは持たない。Gemini API が毎回異なるデザインを生成する。プロンプトでスタイルの方向性（モダン、ミニマル、ポップ等）を指定可能。
2. **Structured Output**: Gemini API の JSON mode + Zod スキーマで出力を型安全に制御する。
3. **1スライド = 1 HTML**: 各スライドは独立した HTML ファイルとして生成される（1920×1080px viewport）。
4. **冪等性**: 同じ入力 + 同じ seed → 同じ出力。再現性を担保する。

## 入力データ形式

`SLIDE_DATA_PACK_V2.json` 形式:

```json
{
  "meta": {
    "title": "プレゼンテーションタイトル",
    "theme": "modern",
    "lang": "ja"
  },
  "slides": [
    {
      "id": 1,
      "type": "title",
      "content": {
        "title": "メインタイトル",
        "subtitle": "サブタイトル"
      }
    },
    {
      "id": 2,
      "type": "content",
      "content": {
        "title": "セクションタイトル",
        "body": "本文テキスト",
        "bullets": ["項目1", "項目2", "項目3"]
      }
    }
  ]
}
```
