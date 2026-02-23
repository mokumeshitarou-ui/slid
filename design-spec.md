# slid 設計仕様書 — 飲食店動画スライド生成システム

## 1. システム概要

slid は、飲食店を撮影した動画に差し込む **情報スライド（PNG連番）** を自動生成するツール。

**最大の目的**: スライド制作の修正ループを減らし、安定した品質で高速に生成する。

### 1.1 コアコンセプト

- **飲食店専用**: 汎用プレゼンではなく、メニュー表・店舗情報に特化
- **スマホ横が最小視聴環境**: TV/モニタでも当然読める（老眼でも4秒で読める）
- **構造固定 × 表情ランダム**: テンプレートの構造（グリッド・文字サイズ）は固定し、色・帯・パターンだけを変える
- **全メニュー掲載**: 省略禁止。入らなければ枚数を増やす（文字を小さくしない）
- **ハルシネーション禁止**: 入力データ以外の情報を使わない。根拠のない「おすすめ」「人気」は生成しない

### 1.2 成果物

| ファイル | 説明 |
|---------|------|
| `slide_001.png` ... `slide_NNN.png` | 1920x1080 PNG連番（動画差し込み用） |
| `slides.zip` | PNG連番をまとめたZIP |
| `SLIDE_DATA_PACK.json` | 再現性のための入力データ保存 |
| `RUN_REPORT.md` | QA結果・要確認事項・ソース一覧 |

---

## 2. アーキテクチャ

```
メニュー画像（Phase 2）→ OCR Extractor → 確認ステップ ─┐
                                                       ↓
手入力 JSON（Phase 1）─────────────────────→ InputPack (店情報 + メニュー)
                                                       ↓
                                              GenreSelector (ジャンル判定 → ユーザー確定)
                                                       ↓
                                              ThemeGenerator (3〜5 デザイン案 → ユーザー選択)
                                                       ↓
                                              SlidePlanner (スライド分割計画)
                                                       ↓
                                              Renderer (HTML/CSS テンプレ + Playwright → PNG)
                                                       ↓
                                              QAValidator (全件掲載チェック・overflow検知)
                                                       ↓
                                              出力: PNG連番 + ZIP + レポート
```

### 2.1 コンポーネント一覧

| コンポーネント | 役割 | 入力 | 出力 |
|--------------|------|------|------|
| **GenreSelector** | ジャンル判定（AI候補3 + ユーザー確定） | InputPack | GenreResult |
| **ThemeGenerator** | デザイントークン3〜5案生成 | GenreResult | ThemeTokens[] |
| **SlidePlanner** | スライド分割・レイアウト決定 | InputPack + ThemeTokens | SlidePlan |
| **Renderer** | HTML/CSS生成 → Playwright PNG化 | SlidePlan + ThemeTokens | PNG連番 |
| **QAValidator** | 全件掲載・overflow・禁止文字チェック | InputPack + SlidePlan + PNG | RUN_REPORT |

### 2.2 LLM責務境界

AIの役割と決定論コードの役割を明確に分離する。これにより「読める」「正しい」の2大原則をコードで保証しつつ、デザインの自由度はAIに任せる。

| レイヤー | 責務 | 担当 |
|---------|------|------|
| **GenreSelector** | 店名・メニュー構成からジャンル候補を推定 | AI（Gemini） |
| **ThemeGenerator** | ジャンル許可パレット内でデザイントークン3〜5案を生成 | AI（Gemini） |
| **SlidePlanner** | スライド分割・行数・テンプレ選択 | 決定論コード |
| **Renderer** | 固定テンプレHTML + CSS変数注入でPNG生成 | 決定論コード |
| **QAValidator** | 全件掲載・overflow・禁止文字・カテゴリ順の検証 | 決定論コード |

**原則**:
- AIにHTMLを自由生成させない。AIが決めるのは ThemeTokens（色・帯・パターン）のみ
- 構造（グリッド・フォントサイズ・行数上限・分割規則）と正確性（全件掲載・カテゴリ順）はコードが保証する
- 「読める」「正しい」を破らない限り、ジャンルに則りながら自由なデザインで生成してよい

### 2.3 流用する既存コード

| 既存モジュール | 流用方法 |
|--------------|---------|
| `src/generator/gemini.ts` | Gemini API クライアント（ジャンル判定・トークン生成に転用） |
| `src/renderer/playwright.ts` | HTML → PNG レンダリング（ビューポート・スクショ処理をそのまま使用） |
| `src/pipeline.ts` | CLI引数パース・ZIP生成を流用 |

---

## 3. 入力データ設計

### 3.1 InputPack（ユーザーが用意する入力の統合形式）

```typescript
interface InputPack {
  schema: "INPUT_PACK_V1";

  shop: {
    name: string;              // 店名
    area: string | null;       // エリア（例: "豊中・岡町"）
    address: string | null;
    access: string | null;     // アクセス（例: "阪急岡町駅 徒歩2分"）
    hours: string | null;      // 営業時間
    closed_days: string | null;
    phone: string | null;
    payment: string | null;    // 支払い方法
    parking: string | null;
    seats: string | null;
    notes: string[];           // 補足（例: "全席禁煙", "旧店名: ○○"）
  };

  menu: {
    tax: "included" | "excluded" | "unknown";
    categories: {
      category_id: string;           // 一意ID（例: "cat_001"）。数値連番。日本語を含めない
      category_name: string;
      category_note: string | null;  // カテゴリ注記（例: "各種大盛 +200円"）
      items: {
        item_id: string;             // 一意ID（例: "item_001"）。数値連番。日本語を含めない
        name: string;
        price_text: string | null;   // 原文そのまま（例: "９５０円", "＋２００円"）
        note: string | null;         // 注記（例: "期間限定", "数量限定"）
        limited: boolean;
        needs_confirmation: boolean; // OCR読取り不確実 → ユーザー確認必要
        confirmation_reasons: ConfirmationReason[]; // 要確認の理由（複数該当あり。該当なしは空配列）
        user_confirmed: boolean;     // ユーザーが確認済み（修正後 true にする）
        ocr_confidence: number | null; // OCR信頼度 0.0〜1.0（手入力時は null）
        source_image_index: number;  // OCR元画像の番号（手入力時は 0）※必須
        location_hint: string | null;      // OCR元画像内の位置ヒント（例: "上部中央"）※optional
      }[];
    }[];
  };

  // OCR 要確認理由コード（1項目に複数該当あり）
  type ConfirmationReason =
    | "LOW_CONFIDENCE"     // ocr_confidence < 0.8
    | "MISSING_PRICE"      // price_text が空 or 価格として不自然
    | "SUSPICIOUS_CHARS"   // 商品名に □, ?, 文字化け疑い
    | "MAYBE_MERGED_TEXT"; // 注記が品名に混入している疑い（例: "大盛＋200円"が品名に入っている）

  // needs_confirmation 判定方式:
  //   1. ocr_confidence < 0.8 → LOW_CONFIDENCE を追加
  //   2. ルールベース検査（正規表現等）で残り3種を判定
  //   3. confirmation_reasons が1つ以上 → needs_confirmation = true
  // confidence だけでは拾えないケース（文字化け、価格欠損等）をルールベースで補完する。

  input_source: "manual" | "ocr"; // 入力方法（OCR → 確認ステップ必須）

  confirmed_addons: {           // 店確認済み追記
    text: string;
    confirmed_by: "shop" | "user";
    date: string;
  }[];

  genre_hint: string | null;   // ユーザーが事前指定（null ならAI判定）
}
```

### 3.2 入力の原則

| ルール | 理由 |
|-------|------|
| メニューは現地撮影が正 | Web情報は古い・非公式で事故る |
| price_text は原文のまま | 解釈すると誤変換の原因になる |
| カテゴリは店の表記に準拠 | 勝手な再分類は禁止 |
| 不明は null | 推測で補完しない |
| おすすめ/人気は根拠がある場合のみ | ハルシネーション防止 |
| OCR入力は確認ステップ必須 | 読取り誤りの修正機会を保証する |
| needs_confirmation は RUN_REPORT に列挙 | ユーザーが見落とさないように |
| ID採番は出現順の連番で固定 | `cat_001`, `cat_002`, ... / `item_001`, `item_002`, ... の形式。ソート不可。途中挿入時は末尾に追番（`item_049`）。日本語を含めない |
| source_image_index は必須 | 手入力時は `0` を設定。OCR時は元画像の番号。location_hint は optional |

### 3.3 OCR取り込みフロー（メニュー画像 → InputPack）

**目的**: メニューを手入力する手間を削減する。ユーザーは現地撮影のメニュー表画像をアップロードし、OCRで読み取った結果を確認・修正してから生成に進む。

#### フロー

```
1. ユーザーがメニュー表画像をアップロード（複数枚対応）
   ↓
2. OCR処理（Gemini Vision）
   → カテゴリ / 品名 / 価格 / 注記 を構造化抽出
   → 各項目に ocr_confidence を付与
   → confidence < 0.8 の項目は needs_confirmation = true
   ↓
3. 確認ステップ（必須）
   → カテゴリ / 品名 / 価格 の一覧を表示
   → needs_confirmation 項目をハイライト表示
   → ユーザーが編集・修正・確定
   ↓
4. 確定後 → InputPack 生成（input_source: "ocr"）
   ↓
5. 通常のパイプラインへ（ジャンル判定 → テーマ選択 → レンダリング）
```

#### 設計原則

| ルール | 理由 |
|-------|------|
| OCR結果は必ず確認ステップを経る | 読取り誤りの修正機会を保証 |
| confidence が低い項目は自動で `needs_confirmation = true` | 見落とし防止 |
| ユーザーが確定するまで生成に進まない | 誤ったメニューでスライドを作らない |
| 画像は SLIDE_DATA_PACK に参照を保存 | 後から原本を確認できるように |
| 手入力との併用も可能 | OCRで取れない部分を手動で補完 |
| **要確認 0件 → 確認画面を自動スキップ** | OCR精度が高い場合は手間を省く |

#### needs_confirmation 自動判定ルール

| ルール | confirmation_reasons に追加 | 判定方式 | 閾値 |
|-------|---------------------------|---------|------|
| confidence < 0.8 | `LOW_CONFIDENCE` | confidence 値 | 0.8（実運用で調整可） |
| price_text が空 or 価格として不自然 | `MISSING_PRICE` | ルールベース（正規表現） | — |
| 商品名に □, ?, 文字化け疑いの文字 | `SUSPICIOUS_CHARS` | ルールベース（正規表現） | — |
| 注記が品名に混入している疑い | `MAYBE_MERGED_TEXT` | ルールベース（パターンマッチ） | — |

1項目に複数の理由が該当する場合はすべて `confirmation_reasons[]` に格納する。要確認理由は UI で行ごとに表示し、編集者が「何を直すべきか」一目で分かるようにする。

#### MVP での実装範囲

- **Phase 1（MVP）**: 手入力のみ。InputPack を直接 JSON で用意
- **Phase 2**: OCR取り込み + 確認UI（CLI版）
- **Phase 3**: Web UI版（3カラムレイアウト）、画像切り抜き・バウンディングボックス
- OCRエンジンは Gemini Vision（既にAPIキーがある）

#### 確認UI（Phase 2 CLI版 最小仕様）

```
[OCR結果確認] 合計: 9カテゴリ / 44件 / 要確認: 6件

カテゴリ: 麺類 (cat_001)
  1. [item_001] 豚骨ラーメン ......... 800円     OK
  2. [item_002] 味噌ラーメン ......... 950円     OK
  3. [item_003] ???ラーメン .......... 9?0円     ! LOW_CONFIDENCE (0.45)

カテゴリ: ご飯もの (cat_002)
  4. [item_004] チャーハン ........... 750円     OK
  5. [item_005] 天大飯 ............... 800円     ! SUSPICIOUS_CHARS

→ 修正する番号を入力（0で全て確定して次へ）:
→ 要確認のみ表示 [f] / 全件表示 [a] / 行追加 [+] / 行削除 [-]:
```

#### 確認UI（Phase 3 Web版 ワイヤー）

```
┌──────────────────────────────────────────────────────────────┐
│  メニュー確認（OCR）  合計: 9カテゴリ / 44件  要確認: 6件    │
│  [要確認のみ] [全件]  検索: [________]  [全て確定して次へ →]  │
├───────────────┬───────────────────────────────┬──────────────┤
│  画像一覧      │  メニュー一覧（編集可テーブル）  │  詳細         │
│               │                               │              │
│  [thumb1]     │  カテゴリ: 麺類                 │  元画像表示   │
│  [thumb2]     │  ┌─────┬──────┬────┬────┬──┐  │  location_hint│
│  ...          │  │品名  │価格   │注記│信頼│! │  │              │
│               │  ├─────┼──────┼────┼────┼──┤  │  確認理由:    │
│  クリックで    │  │豚骨… │800円  │    │0.98│  │  │  LOW_CONF... │
│  拡大表示     │  │???… │9?0円  │    │0.45│! │  │              │
│               │  └─────┴──────┴────┴────┴──┘  │  [確定]       │
│               │  [行追加] [行削除]               │              │
└───────────────┴───────────────────────────────┴──────────────┘
```

- セル直接編集（品名・価格・注記）
- 要確認行のみハイライト表示
- 確定ボタンで `user_confirmed = true`
- 画像切り抜き・バウンディングボックスは Phase 3 以降（サムネ + 拡大で代替）

#### OCR確認後のデータフロー

```
OCR抽出（draft） → 確認・修正 → 確定 InputPack（input_source: "ocr"）
                                    ↓
                         全項目の user_confirmed = true を保証
                         needs_confirmation が残っている項目 → RUN_REPORT に警告
                                    ↓
                         通常パイプラインへ（ジャンル判定〜）
```

---

## 4. ジャンルシステム

### 4.1 大ジャンル（9種）

| ID | ジャンル | 代表的な雰囲気 |
|----|---------|--------------|
| `machichuuka` | 町中華 | 看板感・赤・庶民的 |
| `ramen` | ラーメン | 熱量・黒or白・力強い |
| `kaisen` | 海鮮・寿司 | 藍・水色・清潔感 |
| `yakiniku` | 焼肉・ホルモン | 黒・赤・炎感 |
| `izakaya` | 居酒屋 | 濃グレー・橙or緑・提灯感 |
| `soba` | そば | 生成り・墨・深緑・渋い |
| `udon` | うどん | 白・青・さっぱり |
| `teishoku` | 定食屋 | 暖色or黒・実直 |
| `bento` | 弁当屋 | 白or赤・価格強調 |

### 4.2 サブタイプ（タグ）

ジャンルごとに雰囲気をさらに絞り込むためのタグ。任意指定。

```
ramen:     shoyu / shio / miso / tonkotsu / gyokai / jiro / iekei / tantan / tsukemen
teishoku:  family / workers / junk / healthy / teishoku_sake
soba:      standing / oldshop / modern / heavy
udon:      standing / oldshop / modern / heavy
bento:     budget / karaage / healthy / gourmet
izakaya:   standard / neo / standing
yakiniku:  standard / hormone / luxury
kaisen:    sushi / kaisendon / robata
```

### 4.3 ジャンル判定フロー（混合方式）

1. `genre_hint` がある → そのまま採用（`selected_by: "hint"`）
2. `genre_hint` が null → AI が店名・メニュー構成から候補3つ + 理由を返す
3. ユーザーが1つ確定（CLI: 番号選択 / 将来Discord: リアクション選択）

### 4.4 GenreResult スキーマ

GenreSelector の出力。ThemeGenerator への入力として使う。

```typescript
interface GenreResult {
  // AI（またはヒント）による候補リスト
  candidates: {
    genre: GenreId;            // 例: "machichuuka"
    subtypes: string[];        // 例: ["standard"]
    confidence: number;        // 0.0〜1.0
    reasons: string[];         // 例: ["メニューに中華系が多い", "店名に「飯店」"]
  }[];

  // ユーザー確定結果
  selected: {
    genre: GenreId;
    subtypes: string[];
    selected_by: "model" | "user" | "hint";
    // "model" = AI候補1位をそのまま採用
    // "user"  = ユーザーが候補から選択 or 上書き
    // "hint"  = genre_hint による事前指定
  };
}

// GenreId はジャンルID文字列のユニオン型
type GenreId =
  | "machichuuka" | "ramen" | "kaisen" | "yakiniku"
  | "izakaya" | "soba" | "udon" | "teishoku" | "bento";
```

---

## 5. デザイントークン（ThemeTokens）

### 5.1 設計思想

**「構造は固定、表情だけ変える」**

- 固定（変えない）: フォントサイズ、グリッド、安全領域、行数上限、分割規則
- 変える（3〜5案）: 色、帯の形、行の区切り方、角丸、抽象パターン

これにより「雰囲気は毎回違うが、読めないスライドは絶対に出ない」を実現する。

### 5.2 ThemeTokens スキーマ

```typescript
interface ThemeTokens {
  variant_id: number;          // 1〜5
  variant_label: string;       // 例: "町中華・赤看板"

  colors: {
    bg: string;                // 背景色（例: "#1B1B1B"）
    fg: string;                // 文字色（例: "#FFFFFF"）
    accent: string;            // アクセント1色（例: "#C93A2F"）
    accent_fg: string;         // アクセント上の文字色
    muted: string;             // 補助色（注記・ページ番号用）
  };

  header_style: "solid" | "outline" | "thick_line" | "block";
  row_style: "alternating" | "band" | "thick_line" | "none";
  radius: 0 | 8 | 12 | 16 | 20;
  pattern: "none" | "dots" | "grain" | "stripes";  // 薄い抽象パターン
  pattern_opacity: number;     // 0.02〜0.08（邪魔しない濃度）
  density: "tight" | "normal"; // 余白量（スマホ最優先なら基本tight）
}
```

### 5.3 ジャンル別 許可パレット（初期値）

各ジャンルごとに「この範囲内でランダム」を定義する。

#### 町中華 (machichuuka)
```
bg:      ["#FAFAF5", "#F5F0E8", "#1B1B1B", "#2A1A1A"]
fg:      bg が明色なら "#1A1A1A", 暗色なら "#FFFFFF"
accent:  ["#C93A2F", "#D4443B", "#B5342C", "#E85D4A"]
header:  solid | block
row:     alternating | band
pattern: none | grain
density: tight
```

#### ラーメン (ramen)
```
bg:      ["#1A1A1A", "#0D0D0D", "#2B2B2B", "#FAFAFA"]
fg:      bg が暗色なら "#FFFFFF", 明色なら "#1A1A1A"
accent:  ["#E8572A", "#FF6B35", "#D94E1F", "#FFB800"]
         jiro サブタイプ: ["#FFD700", "#FFC107", "#E8B500"]
header:  solid | thick_line
row:     band | thick_line
pattern: none | grain
density: tight
```

#### 海鮮・寿司 (kaisen)
```
bg:      ["#FAFAFA", "#F0F5FA", "#FFFFFF"]
fg:      "#1A2A3A"
accent:  ["#1A5276", "#2471A3", "#5DADE2", "#1B4F72"]
header:  outline | solid
row:     alternating | none
pattern: none
density: normal
```

#### 焼肉・ホルモン (yakiniku)
```
bg:      ["#1A1A1A", "#0D0D0D", "#2B1A1A"]
fg:      "#FFFFFF"
accent:  ["#E8372A", "#D4443B", "#FF4500", "#CC3300"]
header:  solid | block
row:     band | thick_line
pattern: none | grain
density: tight
```

#### 居酒屋 (izakaya)
```
bg:      ["#2A2A2A", "#1A2A1A", "#3A3A3A"]
fg:      "#FFFFFF"
accent:  ["#E8A52A", "#4CAF50", "#FF8C00", "#66BB6A"]
header:  solid | block
row:     band | alternating
pattern: none | dots
density: tight
```

#### そば (soba)
```
bg:      ["#FAF5EE", "#F5F0E3", "#EDEDED"]
fg:      "#2A2A28"
accent:  ["#2E7D32", "#3E8948", "#5D7B3E", "#4A6741"]
header:  outline | thick_line
row:     alternating | none
pattern: none | grain
density: normal
```

#### うどん (udon)
```
bg:      ["#FFFFFF", "#FAFAFA", "#F0F5FF"]
fg:      "#1A1A2E"
accent:  ["#1565C0", "#1976D2", "#2196F3", "#0D47A1"]
header:  solid | outline
row:     alternating | band
pattern: none
density: normal
```

#### 定食屋 (teishoku)
```
bg:      workers/junk: ["#1A1A1A", "#2B2B2B"]
         family/healthy: ["#FAFAFA", "#FFF8E1"]
fg:      bg に応じて白 or 黒
accent:  workers/junk: ["#FFD700", "#E8572A", "#FF6B35"]
         family: ["#E88B2A", "#FF9800", "#F4A460"]
header:  solid | block
row:     band | alternating
pattern: none | grain
density: tight
```

#### 弁当屋 (bento)
```
bg:      ["#FFFFFF", "#FAFAFA", "#1A1A1A"]
fg:      bg に応じて白 or 黒
accent:  budget: ["#E8372A", "#D4443B"]
         gourmet: ["#5D4037", "#6D4C41", "#8D6E63"]
header:  solid | block
row:     alternating | band
pattern: none
density: tight
```

---

## 6. テンプレートシステム（構造固定）

### 6.1 構造テンプレート（4種）

| テンプレID | 用途 | レイアウト |
|-----------|------|----------|
| `T0_TITLE` | 店名・エリア表示 | 中央配置、大文字 |
| `T1_INFO` | 店舗情報（営業時間等） | 1カラム・ラベル+値の行リスト |
| `T2_MENU_1COL` | メニュー表示（1カラム） | 商品名（左）+ 価格（右揃え） |
| `T3_MENU_2COL` | メニュー表示（2カラム） | 左右2列。商品名が短い場合のみ |

### 6.2 共通グリッド定義

```
キャンバス:       1920 x 1080
安全領域:         上下左右 5%（= 上54px 下54px 左96px 右96px）
使用可能領域:     1728 x 972
```

### 6.3 フォントサイズ（スマホ横最優先）

| 要素 | 最小 | 推奨 | 最大 |
|------|-----|------|-----|
| 店名（タイトル） | 80px | 96px | 120px |
| カテゴリ見出し | 64px | 72px | 80px |
| 商品名（本文） | 54px | 56〜64px | 72px |
| 価格 | 54px | 56〜64px | 72px |
| 注記・補助テキスト | 42px | 44〜48px | 54px |
| ページ番号 | 36px | 40px | 44px |

**鉄則: フォントサイズは絶対に下げない。入らなければスライド枚数を増やす。**

### 6.4 T0_TITLE（タイトルスライド）

```
┌─────────────────────────────────────┐
│                                     │  ← 安全領域 5%
│                                     │
│                                     │
│          店名（96px Bold）           │  ← 垂直中央やや上
│                                     │
│        エリア（56px Medium）          │  ← 店名の下
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### 6.5 T1_INFO（店舗情報スライド）

```
┌─────────────────────────────────────┐
│  店舗情報（72px カテゴリ見出し）       │
│                                     │
│  営業    11:00〜23:00     （54px）   │
│  定休    なし                        │
│  席数    カウンター8席               │
│  支払    カード不可／電子可           │
│  駐車    なし（近隣P）               │
│  備考    全席禁煙                    │
│                                     │
└─────────────────────────────────────┘
```

- **最大6〜8行**（フォント54px想定）
- 行数が多い場合は分割

### 6.6 T2_MENU_1COL（1カラムメニュー）

```
┌─────────────────────────────────────┐
│  麺類 (1/2)（72px カテゴリ見出し）    │
│                                     │
│  豚骨ラーメン ................. 800円 │  ← 56px
│  味噌ラーメン ................. 950円 │
│  超にんにくラーメン ........... 950円 │
│  チャンポン ................... 950円 │
│  中華そば ..................... 750円 │
│  焼きそば ..................... 800円 │
│                                     │
│                          1/10        │  ← ページ番号
└─────────────────────────────────────┘
```

- **1スライド最大8〜10項目**（本文56px想定）
- 注記が多いカテゴリは6〜8項目に減らす
- 超えたら「カテゴリ名 (1/3)」で分割

### 6.7 T3_MENU_2COL（2カラムメニュー）

```
┌──────────────────┬──────────────────┐
│  トッピング       │  飲み物          │
│                  │                  │
│  煮卵 ... 150円  │  瓶ビール . 600円 │
│  ネギ ... 100円  │  ハイボール 500円 │
│  もやし . 100円  │  サワー .. 400円 │
│  チャーシュー300円│  オレンジ . 250円 │
│  目玉焼き 150円  │  コーラ ... 250円 │
│                  │  烏龍茶 .. 250円 │
└──────────────────┴──────────────────┘
```

- **使用条件**: 商品名が短い（全角10文字以内）カテゴリが2つ並ぶ場合のみ
- 1列最大6項目
- 基本は T2_MENU_1COL を使う（スマホ横で最も読みやすい）

### 6.8 少数項目カテゴリの特大表示

1〜3件しかないカテゴリは、空白を作らず文字を大きくして埋める。

```
┌─────────────────────────────────────┐
│  麺屋NOROMA 14周年スペシャル（72px）  │
│                                     │
│                                     │
│     スタミナらーめん                  │  ← 84px Bold
│              700円                   │  ← 84px Bold
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### 6.9 表示ルール（確定事項）

テンプレート内の個別要素の表示方法を定義する。「読める」「正しい」を破らないことが最優先。

#### 6.9.1 税表示（tax）

メニュー系スライド（T2/T3）の**フッター左**に固定で1行表示する。

| tax 値 | 表示テキスト |
|--------|-------------|
| `"included"` | 税込表示 |
| `"excluded"` | 税別表示 |
| `"unknown"` | 税表記不明（店頭表記優先） |

- 各メニュー行には付けない（情報過多の防止）
- フォントサイズは注記サイズ（42〜48px）、muted 色を使用
- T0_TITLE / T1_INFO には表示しない

#### 6.9.2 注記（note）の表示

品名の**下の行**に表示する。価格の右揃えを崩さないため、品名行とは別の行に回す。

```
豚骨ラーメン                    800円    ← 56px, fg色
  期間限定・数量限定              　       ← 44px, muted色
味噌ラーメン                    950円
```

- フォントサイズ: 注記サイズ（42〜48px）
- 色: `muted` 色（太さ/不透明度で本文と差をつける）
- **note がある item は Planner で2行分としてカウント**する。入り切らなければ枚数を増やす
- フォントサイズは下げない（最小42px を守る）

#### 6.9.3 期間限定（limited）の表示

`limited: true` の品は、品名の**後ろ**に角丸テキストラベルを付ける。

```
豚骨ラーメン [期間限定]          800円
```

- ラベル背景: `accent` 色、文字: `accent_fg` 色
- 角丸: ThemeTokens の `radius` 値を使用
- フォントサイズ: 注記サイズ（42〜48px）
- 品名の頭を揃えるため、ラベルは品名の前ではなく後ろに配置する

#### 6.9.4 追記（confirmed_addons）の表示

行数で自動分岐する。

| 条件 | 表示方法 |
|------|---------|
| 3行以下 | T1_INFO スライドの末尾に「追記」セクションとして挿入 |
| 4行以上 | 専用スライド（T4_ADDONS）を生成 |

#### 6.9.5 ページ番号

2箇所に表示する。

| 位置 | 形式 | 例 | 用途 |
|------|------|-----|------|
| 右下 | グローバル通し番号 | `03/12` | 動画全体での位置把握 |
| ヘッダー右（メニュー系のみ） | カテゴリ内番号 | `麺類 (1/3)` | カテゴリの分割状態の把握 |

- T0_TITLE にはページ番号を表示しない
- フォントサイズ: ページ番号サイズ（36〜44px）、muted 色

#### 6.9.6 品名と価格の間（leader）

品名（左寄せ）と価格（右寄せ）の間は**空白（余白）のみ**で繋ぐ。ドットやダッシュは使わない。

```css
.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;                 /* 視線を繋ぐ余白 */
}
.item-name {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;    /* 長い名前の折り返し */
}
.item-price {
  flex: 0 0 auto;
  white-space: nowrap;       /* 価格は折り返さない */
}
```

- デフォルト: `leader_style: "none"`（MVP固定）
- スキーマ上は `"none" | "dash" | "dot"` を定義しておくが、MVP では none のみ使用
- 視線の接続は「行のカード化」「十分なgap」「価格の右端固定」で担保する

---

## 7. スライド分割規則（SlidePlanner）

### 7.1 分割アルゴリズム

```
1. shop_info → T1_INFO（行数制限で分割）
2. menu.categories をループ:
   a. カテゴリの項目数を数える
   b. items_per_slide（初期値: 8）で割って必要枚数を算出
   c. 注記が多い項目があれば items_per_slide を減らす（6〜7）
   d. 1〜3件のカテゴリ → 特大表示モード
   e. 短い商品名のカテゴリが2つ続く → T3_MENU_2COL を検討
3. 全スライドの manifest を生成（掲載件数を記録）
```

### 7.2 overflow 自動修正

```
1. Planner が初期案を生成
2. Renderer が HTML を生成
3. Playwright で DOM を評価:
   element.scrollHeight > element.clientHeight → overflow 検知
4. overflow があれば、該当スライドの items_per_slide を -1 して再計画
5. 再レンダリング（最大3回リトライ）
```

### 7.3 2カラム採用条件

以下の **すべて** を満たす場合のみ T3_MENU_2COL を使用:
- 隣接する2カテゴリの両方が、商品名 全角10文字以内
- 両方とも注記が少ない（note 付き項目が全体の20%以下）
- 両方とも6項目以下

満たさない場合は T2_MENU_1COL。

### 7.4 SlidePlan スキーマ

SlidePlanner の出力。**描画指示書として完結する**設計。Renderer は SlidePlan + ThemeTokens だけで動き、InputPack を参照しない。

```typescript
interface SlidePlan {
  run_id: string;              // ULID
  theme_id: string;            // 選択された ThemeTokens の variant_id に対応
  total_slides: number;
  total_items: number;         // QA用: InputPack の総 items 数と一致すべき
  slides: SlideSpec[];
}

// --- 各スライドの仕様 ---

type SlideSpec =
  | TitleSlide
  | InfoSlide
  | Menu1ColSlide
  | Menu2ColSlide
  | AddonsSlide;

interface SlideBase {
  slide_id: string;            // "S001", "S002", ...（通し番号）
  template: "T0_TITLE" | "T1_INFO" | "T2_MENU_1COL" | "T3_MENU_2COL" | "T4_ADDONS";
  page: {
    global: { index: number; total: number };  // 通し番号（1始まり）
  };
}

// --- T0_TITLE ---
interface TitleSlide extends SlideBase {
  template: "T0_TITLE";
  payload: {
    shop_name: string;
    area: string | null;
  };
}

// --- T1_INFO ---
interface InfoSlide extends SlideBase {
  template: "T1_INFO";
  payload: {
    rows: { label: string; value: string }[];
    addons_section: { text: string }[] | null;  // 3行以下の confirmed_addons
  };
}

// --- T2_MENU_1COL ---
interface Menu1ColSlide extends SlideBase {
  template: "T2_MENU_1COL";
  header: {
    title: string;                   // カテゴリ名
    category_note: string | null;    // カテゴリ注記
    scope_page: { index: number; total: number } | null;  // カテゴリ内ページ（分割時のみ）
  };
  payload: {
    category_id: string;
    items: SlideMenuItem[];
  };
  layout: {
    items_per_slide: number;
    leader_style: "none" | "dash" | "dot";
    density: "tight" | "normal";
    enlarged: boolean;               // 特大表示モード（1〜3件カテゴリ）
  };
  tax_display: string | null;        // フッター税表示テキスト（例: "税込表示"）
}

// --- T3_MENU_2COL ---
interface Menu2ColSlide extends SlideBase {
  template: "T3_MENU_2COL";
  columns: [MenuColumn, MenuColumn];  // 左列・右列
  layout: {
    items_per_col: number;
    leader_style: "none" | "dash" | "dot";
    density: "tight" | "normal";
  };
  tax_display: string | null;
}

interface MenuColumn {
  header: {
    title: string;
    category_note: string | null;
  };
  payload: {
    category_id: string;
    items: SlideMenuItem[];
  };
}

// --- T4_ADDONS ---
interface AddonsSlide extends SlideBase {
  template: "T4_ADDONS";
  payload: {
    rows: { text: string; confirmed_by: "shop" | "user"; date: string }[];
  };
}

// --- メニュー項目（描画用。実データ埋め込み + ID保持） ---
interface SlideMenuItem {
  item_id: string;             // トレース・QA用（Rendererは使わない）
  name: string;
  price_text: string | null;
  note: string | null;
  limited: boolean;
}
```

**設計原則**:
- Planに実データを埋め込む。Rendererが InputPack を逆引きしない
- `item_id` / `category_id` は QA の全件掲載チェック用に保持する（`InputPack.item_id集合 === SlidePlan内item_id集合` で検証）
- **SlidePlan はユーザー編集対象にしない**。修正は InputPack を直して Plan を再生成する
- overflow 再分割も SlidePlan 単体で完結する（items を減らして再配置するだけ）

### 7.5 テンプレート決定表

Planner がどの入力データに対してどのテンプレートを使うかのルール。

| 入力データ | テンプレート | 条件 |
|-----------|------------|------|
| `shop` 情報 | `T0_TITLE` | 常に1枚目 |
| `shop` 情報（詳細） | `T1_INFO` | 2枚目〜。6〜8行で分割 |
| `confirmed_addons`（3行以下） | `T1_INFO` に統合 | INFO末尾の「追記」セクション |
| `confirmed_addons`（4行以上） | `T4_ADDONS` | 独立スライド |
| カテゴリ（4件以上） | `T2_MENU_1COL` | デフォルト。8〜10項目/枚 |
| カテゴリ（1〜3件） | `T2_MENU_1COL`（特大） | `layout.enlarged = true` |
| 隣接2カテゴリ（短い商品名） | `T3_MENU_2COL` | 7.3の条件を全て満たす場合のみ |

**スライド順序**: T0_TITLE → T1_INFO → (T4_ADDONS) → メニュー系（InputPack の categories 順）

---

## 8. デザイン案選択フロー

### 8.1 プレビュー生成（代表3枚だけ）

全デッキを3〜5案生成すると重いので、プレビューは代表3枚:

1. **Title** スライド（雰囲気が最も出る）
2. **Info** スライド（視認性チェック）
3. **Menu** スライド（最も典型的なカテゴリ1枚）

### 8.2 選択後に本番レンダリング

```
ユーザーが variant=3 を選択
  ↓
ThemeTokens[3] で全スライドを本番レンダリング
  ↓
PNG連番 + ZIP + RUN_REPORT
```

---

## 9. レンダリング仕様

### 9.1 HTML/CSS テンプレート方式

Gemini にデザインを丸投げするのではなく、**固定テンプレート HTML/CSS + ThemeTokens の CSS変数注入** で生成する。

**テンプレートエンジンは使わない**。TypeScript 関数でHTMLを直接組み立てる。

理由:
- 外部依存が増えない
- HTMLエスケープ方針を関数内で統一できる（OCR由来テキストの安全化）
- テンプレートの条件分岐（特大表示、2カラム等）がTypeScriptのロジックで自然に書ける

```typescript
// 例: テンプレート関数のシグネチャ
function renderMenu1Col(slide: Menu1ColSlide, theme: ThemeTokens): string {
  // ThemeTokens → CSS変数
  const cssVars = themeToCssVars(theme);
  // SlideMenuItem[] → HTML行
  const rows = slide.payload.items.map(item => menuItemToHtml(item, slide.layout));
  // 組み立て
  return `<!DOCTYPE html>
<html><head><style>
  :root { ${cssVars} }
  /* 固定グリッド・フォントサイズのCSS */
</style></head>
<body>...</body></html>`;
}
```

**文字の安全化**: テンプレート関数内で全テキストをHTMLエスケープする。絵文字・機種依存文字は QAValidator で事前検出し、要確認扱いにする（無断削除しない）。

### 9.2 フォント

- **Noto Sans JP** をシステムにインストール（Google Fonts CDN 不使用 → オフライン安定）
- ウェイト: Medium (500) / Bold (700) のみ
- 明朝体は使わない（視認性優先）

### 9.3 Playwright 設定

```typescript
viewport: { width: 1920, height: 1080 }
deviceScaleFactor: 2  // Retina品質（出力: 3840x2160）
```

**プレビューも本番と同一解像度**（1920x1080, deviceScaleFactor: 2）で生成する。解像度を落とすとフォントの見え方が変わり、「プレビューで選んだのに本番で違う」が起きるため。速度は枚数を絞ることで担保する（プレビュー = Title + Info + Menu代表1枚 × 案数）。

### 9.4 禁止事項（レンダリング時）

| 禁止 | 理由 |
|------|------|
| 写真・イラスト・アイコン | 視聴者の注意を散らす＋文字化けリスク |
| 絵文字・特殊記号・機種依存文字 | 文字化けの原因 |
| 細線（4px未満） | スマホで見えない |
| グラデーション背景 | コントラストが不安定になる |
| Google Fonts CDN | オフライン/遅延リスク |

---

## 10. QA（品質保証）

### 10.1 必須チェック項目

| チェック | 方法 | 失敗時 |
|---------|------|--------|
| 全件掲載 | InputPack.menu の総 items 数 = SlidePlan の掲載数 | エラー停止 |
| 最小フォント | 54px未満のテキスト要素がないこと | 分割して再レンダリング |
| overflow | DOM の scrollHeight > clientHeight | items_per_slide を減らして再計画 |
| 禁止文字 | 絵文字/機種依存文字の正規表現検出 | 自動除去（意味は保持） |
| 禁止表現 | 「おすすめ」「人気」等が入力の evidence なしで混入 | 除去 |
| カテゴリ順 | InputPack の categories 順 = SlidePlan の順 | エラー |

### 10.2 RUN_REPORT.md の内容

```markdown
# 生成レポート

## 基本情報
- 店名: XXX
- ジャンル: XXX (サブタイプ: XXX)
- 選択バリアント: #3
- 生成スライド数: XX 枚

## QA結果
- 全件掲載: OK (入力48件 / 掲載48件)
- 最小フォント: OK (54px以上)
- overflow: OK (検知なし)
- 禁止文字: OK
- 禁止表現: OK

## OCR確認結果（input_source: "ocr" の場合のみ）
- 入力方法: OCR
- OCR総件数: XX件
- 要確認件数: XX件 (LOW_CONFIDENCE: X, MISSING_PRICE: X, SUSPICIOUS_CHARS: X, MAYBE_MERGED_TEXT: X)
- ユーザー確認済み: XX件 / XX件
- 未確認のまま残った項目: (あれば列挙 → 警告扱い)

## 要確認事項
- (needs_confirmation があればここに列挙)

## 選択ログ
- 提示案数: X案
- 選択: variant #X / rejected_all (retry: X回)
- rejection_memo: (あれば記載)

## conflicts（情報の矛盾）
- (Web調査で矛盾があった場合にここに列挙)
```

---

## 11. CLI インターフェース（MVP）

```bash
# 基本実行
npx tsx src/pipeline.ts <input.json>

# オプション
npx tsx src/pipeline.ts <input.json> \
  --output-dir ./output \
  --genre machichuuka \
  --sub-type "" \
  --variant 3 \
  --skip-preview
```

### 11.1 インタラクティブモード（デフォルト）

```
$ npx tsx src/pipeline.ts norumatsu.json

[1/5] 入力データ読み込み...
  → 店名: 野呂松飯店
  → メニュー: 10カテゴリ / 48品

[2/5] ジャンル判定...
  候補:
    1. 町中華 (confidence: 0.85)
    2. ラーメン (confidence: 0.60)
    3. 定食屋 (confidence: 0.40)
  → 番号を選択 (1-3): 1

[3/5] デザイン案生成 (3案)...
  プレビュー生成中...
  → output/preview/variant_1/ (3枚)
  → output/preview/variant_2/ (3枚)
  → output/preview/variant_3/ (3枚)
  → 番号を選択 (1-3): 2

[4/5] 本番レンダリング (variant #2)...
  → slide_001.png ... slide_015.png

[5/5] QA...
  → 全件掲載: OK (48/48)
  → 最小フォント: OK
  → overflow: OK

完了: output/slides.zip (15枚)
```

---

## 12. 4秒/枚の情報量設計

### 12.1 表示時間と可読性の関係

1920x1080 → スマホ横表示時、体感で約半分に縮小される。
54px → スマホ上で体感 27〜30px。これが「老眼でも4秒で読める」下限。

### 12.2 1スライドあたりの上限

| テンプレ | 最大行数 | 備考 |
|---------|---------|------|
| T1_INFO | 6〜8行 | ラベル+値で1行 |
| T2_MENU_1COL | 8〜10項目 | 注記が多ければ6〜8 |
| T3_MENU_2COL | 各列6項目（計12） | 短い商品名のみ |
| 特大表示 | 1〜3項目 | 文字を大きくして埋める |

---

## 13. ファイル構成（実装後の想定）

```
src/
  schema/
    input-pack.ts           # InputPack Zod スキーマ（needs_confirmation 含む）
    theme-tokens.ts         # ThemeTokens Zod スキーマ
    slide-plan.ts           # SlidePlan Zod スキーマ
    genre.ts                # ジャンル定義・パレット
  genre/
    selector.ts             # GenreSelector（AI判定 + CLI選択）
  theme/
    generator.ts            # ThemeGenerator（3〜5案生成）
    palettes.ts             # ジャンル別許可パレット定義
  planner/
    slide-planner.ts        # SlidePlanner（分割アルゴリズム）
  renderer/
    templates.ts            # HTML/CSSテンプレート生成
    playwright.ts           # Playwright PNG レンダリング
  qa/
    validator.ts            # QAValidator
  ocr/                      # Phase 2: OCR取り込み
    extractor.ts            # Gemini Vision → 構造化メニューデータ
    reviewer.ts             # OCR結果の確認・修正フロー（CLI / Web UI）
  pipeline.ts               # メインパイプライン
example/
  norumatsu.json            # 野呂松飯店テストデータ
data/                       # 学習データ（L1以降で使用）
  selection_stats/           # ジャンル別採用傾向の集計JSON
```

---

## 14. アーキテクチャ判断（確定事項）

### 14.1 run_id の採番

**ULID**（Universally Unique Lexicographically Sortable Identifier）を使用する。

- 時系列ソート可能（ファイルシステム上で自然に並ぶ）
- 衝突確率が十分に低い
- パッケージ: `ulid`（軽量）

ディレクトリ構造:
```
output/runs/{run_id}/
  input_pack.json
  genre_result.json
  theme_tokens.json
  slide_plan.json
  selection_log.json
  preview/
  slides/
  run_report.md
```

### 14.2 Gemini API リトライ戦略

| 条件 | 動作 |
|------|------|
| リトライ対象 | HTTP 429（レート制限）/ 5xx / タイムアウト のみ |
| 最大回数 | 3回 |
| バックオフ | exponential（0.5s → 1.5s → 4s）+ jitter |
| 成功 | 通常処理を続行 |
| 全リトライ失敗 | パイプラインを中断せず、RUN_REPORT に `FAILED_STEP` と `retry_count` を記録してユーザーに返す |

4xx（認証エラー等）はリトライせず即エラーとする。

---

## 15. 技術スタック

| 技術 | 用途 |
|------|------|
| Node.js 20+ | ランタイム |
| TypeScript (strict) | 型安全 |
| Zod | スキーマ検証 |
| Google Gemini API | ジャンル判定・トークン生成 |
| Playwright | HTML → PNG レンダリング |
| Noto Sans JP | 日本語フォント（システムインストール） |
| archiver | ZIP生成 |
| ulid | run_id 生成（時系列ソート可能なユニークID） |

---

## 16. 将来拡張（今はやらない）

| 拡張 | 概要 | 前提 |
|------|------|------|
| 対話微調整（パッチJSON） | HTML全文再生成ではなく、編集命令JSONでThemeTokens/LayoutParamsを部分更新 → 再レンダ | MVP安定後・スキーマ設計済み |
| run_id 中間生成物保存 | 各実行を run_id で識別し、InputPack/ThemeTokens/SlidePlan/PNG を保存。再実行・差分レンダを可能にする | MVP安定後 |
| Discord Bot | スレッド内の画像D&D → 自動生成 | MVP安定後 |
| OCR確認UI（Web版） | 編集可能テーブルでOCR結果を確認・修正（セクション3.3のPhase 2） | Gemini Vision・基本フロー安定後 |
| Web自動リサーチ | 店情報の自動収集 | Perplexity API |
| PPTX出力 | 編集可能な中間形式 | PptxGenJS |
| テンプレ追加 | 季節メニュー・セットメニュー等の専用レイアウト | 運用実績後 |
| ワンクリックセットアップ | install.bat / install.command で Node/Playwright/フォント一括セットアップ | 配布段階 |
| 学習機能 L0（SelectionLog） | デザイン案の選択/却下ログを保存（セクション16.3） | **MVP に含める**（工数ほぼゼロ） |
| 学習機能 L1（プロンプト注入） | 蓄積ログをジャンル別集計 → ThemeGenerator プロンプトに採用傾向を注入 | データ10〜20件蓄積後 |
| 学習機能 L2（パレット重み） | ジャンル別許可パレットに採用率ベースの動的重みを付与 | データ50件以上蓄積後 |

### 16.1 パッチJSON微調整（設計メモ）

MVPでは「3〜5案から選ぶだけ」で運用するが、将来の対話微調整に備えて以下の設計方針を記録する。

**方針**: ユーザーの指示（例:「背景を暗く」「余白を詰める」「見出しを太く」）に対して、LLMはHTML全文ではなく**編集命令JSON（パッチ）** を返す。パッチを ThemeTokens / LayoutParams に適用し、テンプレートHTMLを再レンダする。

```typescript
// パッチ命令の例（将来実装時のスキーマ案）
interface ThemePatch {
  run_id: string;
  patches: {
    path: string;        // 例: "colors.bg", "density", "radius"
    value: unknown;      // 新しい値
    reason: string;      // LLMが返す変更理由
  }[];
}
```

**利点**:
- HTML全文を持ち回らないのでコスト・遅延が減る
- テンプレート側のルール（最小フォント等）が常に効くのでドリフトしない
- 差分が明示的なのでユーザーが変更内容を把握しやすい

### 16.2 run_id 中間生成物保存（設計メモ）

```
output/
  runs/
    {run_id}/
      input_pack.json        # 入力データ（再現用）
      genre_result.json      # ジャンル判定結果
      theme_tokens.json      # 選択されたThemeTokens
      slide_plan.json        # 分割計画
      selection_log.json     # デザイン案選択ログ（学習機能の基礎データ）
      preview/               # プレビューPNG
      slides/                # 本番PNG
      run_report.md          # QAレポート
```

**利点**:
- 同じ店を再生成する際に前回の設定を引き継げる
- パッチ微調整時に前回のTokensをベースにできる
- デバッグ・品質改善の追跡が容易

### 16.3 選択ログ・学習機能（SelectionLog）

ユーザーがどのデザイン案を選んだか（または全却下したか）を蓄積し、ジャンルごとに採用されやすいデザインを学習する。

#### L0: ログ保存（MVP に含める）

パイプラインの選択ステップで `selection_log.json` を1ファイル書くだけ。追加工数ほぼゼロ。

```typescript
interface SelectionLog {
  run_id: string;
  genre: string;
  sub_types: string[];
  shop_name: string;
  timestamp: string;               // ISO 8601

  // 提示された全案のトークン
  candidates: ThemeTokens[];

  // ユーザーの行動
  action: "selected" | "rejected_all";
  selected_variant_id: number | null;  // rejected_all なら null
  rejection_memo: string | null;       // 全却下時の理由メモ（例: "暗すぎた", "赤が強すぎた"）

  // rejected_all → 再生成した場合
  retry_count: number;                 // 再生成回数（0 = 一発OK）
}
```

**rejected_all 時の理由メモ**: 全案却下の場合に「何が嫌だったか」を1行メモで残す。L1で使う。
CLI: `→ 理由を一言（任意、Enter でスキップ）: 暗すぎた`

#### L1: プロンプト注入（Phase 2・データ10〜20件蓄積後）

蓄積した SelectionLog をジャンル別に集計し、ThemeGenerator の Gemini プロンプトに few-shot 例として注入する。モデル学習は不要。

```
// ThemeGenerator のGeminiプロンプトに追加する例
過去の選択傾向（ラーメン店、15件）:
- 暗背景(#1A1A1A系) + オレンジアクセント: 採用率 73%
- 白背景 + 赤アクセント: 採用率 20%
- band 行スタイル: 採用率 80%
- 全却下理由: "明るすぎ"(2件), "色が地味"(1件)
この傾向を考慮して3案生成してください。ただし多様性も確保し、全案が同じ系統にならないこと。
```

**コスト**: 追加トークン数十行分。API呼び出し回数の増加なし。

#### L2: パレット重み動的調整（Phase 3・データ50件以上蓄積後）

`palettes.ts` のジャンル別許可パレットに、採用率ベースの重みを動的に付与する。

```typescript
// 例: ラーメンジャンルの bg 選択時
// 蓄積データから: #1A1A1A が 73% 採用、#FAFAFA が 20% 採用
// → ランダム生成時に #1A1A1A が出やすくなる（ただし多様性のため完全には偏らせない）
```

#### 集計ファイル

```
data/
  selection_stats/
    ramen.json          # ラーメン店の採用傾向
    machichuuka.json    # 町中華の採用傾向
    ...
```

L1以降で使用。ジャンル別に SelectionLog を集計した統計データ。
