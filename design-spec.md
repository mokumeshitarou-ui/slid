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
InputPack (店情報 + メニュー)
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

### 2.2 流用する既存コード

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
      category_name: string;
      category_note: string | null;  // カテゴリ注記（例: "各種大盛 +200円"）
      items: {
        name: string;
        price_text: string | null;   // 原文そのまま（例: "９５０円", "＋２００円"）
        note: string | null;         // 注記（例: "期間限定", "数量限定"）
        limited: boolean;
      }[];
    }[];
  };

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

1. `genre_hint` がある → そのまま採用
2. `genre_hint` が null → AI が店名・メニュー構成から候補3つ + 理由を返す
3. ユーザーが1つ確定（CLI: 番号選択 / 将来Discord: リアクション選択）

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

```html
<!-- 例: T2_MENU_1COL テンプレート -->
<html>
<head>
  <style>
    :root {
      --bg: {{colors.bg}};
      --fg: {{colors.fg}};
      --accent: {{colors.accent}};
      --radius: {{radius}}px;
      /* ... ThemeTokens を CSS変数に展開 */
    }
    /* 固定グリッド・フォントサイズのCSS */
  </style>
</head>
<body>
  <!-- カテゴリ見出し + メニュー行を動的生成 -->
</body>
</html>
```

### 9.2 フォント

- **Noto Sans JP** をシステムにインストール（Google Fonts CDN 不使用 → オフライン安定）
- ウェイト: Medium (500) / Bold (700) のみ
- 明朝体は使わない（視認性優先）

### 9.3 Playwright 設定

```typescript
viewport: { width: 1920, height: 1080 }
deviceScaleFactor: 2  // Retina品質（出力: 3840x2160）
```

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

## 要確認事項
- (needs_confirmation があればここに列挙)

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
    input-pack.ts           # InputPack Zod スキーマ
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
  pipeline.ts               # メインパイプライン
example/
  norumatsu.json            # 野呂松飯店テストデータ
```

---

## 14. 将来拡張（今はやらない）

| 拡張 | 概要 | 前提 |
|------|------|------|
| Discord Bot | スレッド内の画像D&D → 自動生成 | MVP安定後 |
| OCR自動化 | メニュー画像 → InputPack 自動変換 | Gemini Vision |
| Web自動リサーチ | 店情報の自動収集 | Perplexity API |
| PPTX出力 | 編集可能な中間形式 | PptxGenJS |
| テンプレ追加 | 季節メニュー・セットメニュー等の専用レイアウト | 運用実績後 |

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
