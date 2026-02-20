# 飲食店スライド自動生成システム

## プロジェクト概要

飲食店を撮影した動画に差し込む**情報スライド（PNG連番 1920x1080 16:9）**を
Discord Bot経由で自動生成するシステム。

すべてのやり取りは**日本語**で行う。

## ゴール成果物

- `slide_001.png` ... `slide_NNN.png`（1920x1080, 16:9）
- `slides.zip`（PNG連番をZIP）
- `SLIDE_DATA_PACK_V2.json`（再現性のため必ず保存）
- `RUN_REPORT.md`（QA結果、要確認、矛盾、ソース一覧）

## パイプライン

```
画像収集 → OCR抽出 → Web店情報収集 → データ統合 → スライド分割 → レンダリング → QA → Discord報告
   ↓          ↓           ↓             ↓           ↓            ↓         ↓        ↓
 Discord    Gemini    Perplexity    Pack Builder   Planner    Playwright  Validator  Discord
```

## エージェント構成（7体）

| ID | エージェント | 役割 | 定義ファイル |
|---|---|---|---|
| A | Orchestrator | 司令塔・Discord連携・実行管理 | `src/agents/orchestrator/` |
| B | OCR Extractor | メニュー画像→テキスト抽出（Gemini） | `src/agents/ocr-extractor/` |
| C | Web Researcher | 店情報収集（Perplexity/GPT） | `src/agents/web-researcher/` |
| D | Pack Builder | データ統合・正規化 | `src/agents/pack-builder/` |
| E | Slide Planner | スライド分割・レイアウト設計 | `src/agents/slide-planner/` |
| F | Renderer | HTML→PNG変換（Playwright） | `src/agents/renderer/` |
| G | QA / Validator | 品質検証・overflow検出 | `src/agents/qa-validator/` |

## データ設計（3つのJSON）

| スキーマ | 役割 | ファイル |
|---|---|---|
| MENU_OCR_PACK_V2 | OCR生データ（原文厳守） | `src/schemas/menu-ocr-pack-v2.ts` |
| SHOP_INFO_PACK_V2 | Web店情報（根拠URL必須） | `src/schemas/shop-info-pack-v2.ts` |
| SLIDE_DATA_PACK_V2 | 統合データパック（唯一の正） | `src/schemas/slide-data-pack-v2.ts` |

## 絶対ルール

1. **写真・イラスト・アイコン禁止** - 装飾は矩形・太線のみ
2. **全メニュー正確に掲載** - 省略禁止、入力総数 = 掲載総数
3. **フォント最小32px** - 小さくする代わりに枚数を増やす
4. **根拠なし推薦・捏造禁止** - 「おすすめ」「人気」等の断定なし
5. **絵文字・機種依存文字禁止** - 文字化け対策
6. **メニューカテゴリは原文通り** - 勝手な再分類禁止
7. **価格はprice_textをそのまま表示** - 解釈禁止
8. **矛盾情報は併記** - 断定禁止、conflicts表示
9. **不明/読取不可は「要確認」明示** - 勝手に補完しない

## デザイン仕様

- キャンバス: 1920x1080（16:9）
- 安全領域: 上下左右 7%
- 本文フォント最小: 32px（推奨 34-40px）
- フォント: Noto Sans JP > Yu Gothic > Hiragino Sans
- 細線禁止（太線または矩形背景でセクション分け）
- 情報量は枚数で担保（詰め込まない）

## ディレクトリ構成

```
slide/
├── CLAUDE.md                          # このファイル
├── package.json                       # 依存関係
├── tsconfig.json                      # TypeScript設定
├── .env.example                       # 環境変数テンプレート
├── .gitignore
├── src/
│   ├── agents/
│   │   ├── orchestrator/              # A. 司令塔
│   │   │   └── README.md
│   │   ├── ocr-extractor/            # B. OCR抽出
│   │   │   └── README.md
│   │   ├── web-researcher/           # C. Web調査
│   │   │   └── README.md
│   │   ├── pack-builder/             # D. データ統合
│   │   │   └── README.md
│   │   ├── slide-planner/            # E. スライド分割
│   │   │   └── README.md
│   │   ├── renderer/                 # F. レンダリング
│   │   │   └── README.md
│   │   └── qa-validator/             # G. QA検証
│   │       └── README.md
│   ├── schemas/                       # JSONスキーマ / TypeScript型定義
│   │   ├── menu-ocr-pack-v2.ts
│   │   ├── shop-info-pack-v2.ts
│   │   └── slide-data-pack-v2.ts
│   ├── templates/                     # HTMLスライドテンプレート
│   │   ├── base.html
│   │   ├── title.html
│   │   ├── shop-info.html
│   │   └── menu.html
│   └── discord/                       # Discord Bot設定
│       └── README.md
├── docs/                              # 設計ドキュメント
│   ├── workflow.md
│   └── design-spec.md
├── output/                            # 成果物出力先
└── runs/                              # 実行ごとのデータ保存
```

## 環境変数

```
DISCORD_BOT_TOKEN=
GEMINI_API_KEY=
PERPLEXITY_API_KEY=
OPENAI_API_KEY=
```

## Discord コマンド（MVP）

| コマンド | 説明 |
|---|---|
| `/run` | このスレッドの画像で一括実行 |
| `/status` | 抽出件数・要確認・矛盾・最終更新 |
| `/confirm` | 店確認済み情報を追加 |
| `/render` | データパックから再レンダリング |
