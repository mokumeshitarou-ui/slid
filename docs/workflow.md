# ワークフロー定義

## パイプライン全体図

```
[Discord スレッド]
       |
       v
  A. Orchestrator ─── run_id 発行
       |
       ├─→ B. OCR Extractor ─→ MENU_OCR_PACK_V2.json
       |
       ├─→ C. Web Researcher ─→ SHOP_INFO_PACK_V2.json
       |
       v
  D. Pack Builder ─→ SLIDE_DATA_PACK_V2.json（唯一の正）
       |
       v
  E. Slide Planner ─→ スライド分割案
       |
       v
  F. Renderer ─→ slide_001.png ... slide_NNN.png
       |       ↑
       |       └── overflow検出時、再分割して再レンダ
       v
  G. QA / Validator ─→ RUN_REPORT.md
       |
       v
  [Discord 報告] ─→ slides.zip + QA要約 + 要確認リスト
```

## 各ステップの詳細

### Step 1: 画像収集（Orchestrator）

- トリガー: Discordスレッドへの画像添付 or `/run` コマンド
- スレッド内の全添付画像を収集
- 重複排除（ファイルハッシュで判定）
- `runs/{run_id}/images/` に保存

### Step 2: OCR抽出（OCR Extractor）

- 入力: メニュー画像
- Gemini APIで構造化抽出
- 原文厳守（推測・補完禁止）
- 出力: `runs/{run_id}/MENU_OCR_PACK_V2.json`

### Step 3: Web店情報収集（Web Researcher）

- 入力: 店名 + エリア情報
- Perplexity APIで検索
- メニュー情報は収集しない（事故防止）
- 最低2ソース照合、矛盾はconflictsに記録
- 出力: `runs/{run_id}/SHOP_INFO_PACK_V2.json`

### Step 4: データ統合（Pack Builder）

- 入力: OCR結果 + Web店情報 + ユーザー確定情報
- 禁止文字除去（絵文字・機種依存→言い換え）
- 件数整合チェック
- 出力: `runs/{run_id}/SLIDE_DATA_PACK_V2.json`

### Step 5: スライド分割（Slide Planner）

- 入力: SLIDE_DATA_PACK_V2
- タイトル → 店情報 → メニュー（カテゴリ別複数枚）の順で構成
- フォント固定（最小32px）、溢れたら枚数で対応
- カテゴリ分割時は "カテゴリ名 (1/N)" 表記

### Step 6: レンダリング（Renderer）

- 入力: 分割案 + HTMLテンプレート
- Playwright で viewport 1920x1080 固定スクリーンショット
- overflow 自動検出 → 再分割 → 再レンダ（収束まで）
- 出力: `runs/{run_id}/slides/slide_XXX.png` + `slides.zip`

### Step 7: QA検証（QA / Validator）

- 全メニュー掲載チェック（入力総数 = 掲載総数）
- フォントサイズチェック（32px未満なし）
- 禁止表現チェック（根拠なし推薦なし）
- 禁止文字チェック（絵文字なし）
- overflow チェック
- 出力: `runs/{run_id}/RUN_REPORT.md`

### Step 8: Discord報告（Orchestrator）

- slides.zip を添付
- QA要約（PASS/FAIL + 件数）
- 要確認リスト（needs_confirmation）
- 矛盾情報（conflicts）

## 再実行・差分更新

| コマンド | 動作 |
|---|---|
| `/run` | 全パイプライン再実行 |
| `/confirm` + 情報追加 | Pack Builder から再実行 |
| `/render` | Slide Planner + Renderer + QA のみ再実行 |

## ファイル保存構造

```
runs/
└── {run_id}/
    ├── images/                  # 元画像
    ├── MENU_OCR_PACK_V2.json   # OCR結果
    ├── SHOP_INFO_PACK_V2.json  # Web店情報
    ├── SLIDE_DATA_PACK_V2.json # 統合データパック
    ├── slide_plan.json          # スライド分割案
    ├── slides/                  # PNG連番
    │   ├── slide_001.png
    │   ├── slide_002.png
    │   └── ...
    ├── slides.zip               # ZIP
    └── RUN_REPORT.md            # QAレポート
```
