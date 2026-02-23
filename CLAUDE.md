# slid — 飲食店動画スライド生成ツール

## プロジェクト概要

`slid` は、飲食店を撮影した動画に差し込む **情報スライド（PNG連番）** を自動生成するCLIツール。
店舗情報とメニューデータを入力し、ジャンルに応じたデザインで1920x1080のPNG連番を出力する。

### 最大の目的

スライド制作の修正ループを減らし、安定した品質で高速に生成すること。

### 設計思想: 構造固定 × 表情ランダム

- **構造（テンプレート）は固定**: フォントサイズ・グリッド・行数上限・分割規則は決定論で動く
- **表情（デザイントークン）はランダム**: 色・帯・角丸・抽象パターンをジャンルの許可範囲内で3〜5案生成
- ユーザーが1案を選択 → 本番レンダリング

### LLM責務境界

- **AI（Gemini）が担当**: ジャンル判定（GenreSelector）、デザイントークン生成（ThemeGenerator）
- **決定論コードが担当**: スライド分割（SlidePlanner）、HTML/CSS生成（Renderer）、品質検証（QAValidator）
- AIにHTMLを自由生成させない。AIが決めるのは ThemeTokens（色・帯・パターン）のみ

## アーキテクチャ

```
InputPack (店情報 + メニュー)
  → GenreSelector (ジャンル判定)
  → ThemeGenerator (デザイン案 3〜5)
  → SlidePlanner (分割計画)
  → Renderer (HTML/CSS + Playwright → PNG)
  → QAValidator (全件掲載チェック)
  → 出力: PNG連番 + ZIP + レポート
```

### コアコンポーネント

| ディレクトリ | 役割 |
|-------------|------|
| `src/schema/` | Zod スキーマ定義（InputPack, ThemeTokens, SlidePlan, Genre） |
| `src/genre/` | ジャンル判定（AI候補 + ユーザー確定） |
| `src/theme/` | デザイントークン生成・ジャンル別パレット |
| `src/planner/` | スライド分割アルゴリズム |
| `src/renderer/` | HTMLテンプレート生成 + Playwright PNG化 |
| `src/qa/` | QA検証（全件掲載・overflow・禁止文字等） |
| `src/pipeline.ts` | メインパイプライン（CLIオーケストレーション） |

## 技術スタック

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **AI**: Google Gemini API (`@google/genai`) — ジャンル判定・トークン生成
- **Rendering**: Playwright — HTML → PNG
- **Validation**: Zod
- **Font**: Noto Sans JP (システムインストール)

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

## スライド生成の絶対ルール

1. **スマホ横が最小視聴環境**: 本文最小54px。小さくするくらいなら枚数を増やす
2. **全メニュー掲載**: 省略禁止。枚数無制限
3. **カテゴリ構造厳守**: 店のメニュー表のカテゴリに準拠。勝手な再分類禁止
4. **ハルシネーション禁止**: 入力データ以外の情報を使わない。根拠のないおすすめ/人気は禁止
5. **写真/イラスト/アイコン禁止**: 装飾画像も禁止。文字と図形のみ
6. **文字化け対策**: 絵文字/特殊記号/機種依存文字を使わない
7. **細線禁止**: 4px未満の線は使わない
8. **4秒/枚**: 1枚に詰め込まない

## ジャンル（9種）

町中華 / ラーメン / 海鮮・寿司 / 焼肉・ホルモン / 居酒屋 / そば / うどん / 定食屋 / 弁当屋

## テンプレート（構造固定 5種）

- `T0_TITLE`: 店名・エリア
- `T1_INFO`: 店舗情報
- `T2_MENU_1COL`: 1カラムメニュー（基本これを使う）
- `T3_MENU_2COL`: 2カラムメニュー（短い商品名が条件）
- `T4_ADDONS`: 追記情報（4行以上の confirmed_addons）

## 入力データ形式

`InputPack` JSON。詳細は `design-spec.md` を参照。

```json
{
  "schema": "INPUT_PACK_V1",
  "shop": { "name": "...", "area": "...", ... },
  "menu": {
    "tax": "unknown",
    "categories": [
      {
        "category_name": "麺類",
        "items": [
          { "name": "豚骨ラーメン", "price_text": "800円", "note": null, "limited": false }
        ]
      }
    ]
  },
  "confirmed_addons": [],
  "genre_hint": null
}
```
