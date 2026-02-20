# F. Renderer（レンダリング）

## 役割

スライド分割案とデータパックから HTML を生成し、Playwright で PNG に変換する。

## 技術スタック

- **HTML/CSS** でスライドテンプレートを構成
- **Playwright** で viewport 1920x1080 固定の screenshot
- **Noto Sans JP** をサーバにインストール（文字化け防止）

## 絶対ルール

1. **写真・イラスト・アイコン禁止** - 装飾は矩形・太線のみ
2. **文字化け対策** - 絵文字・特殊記号・機種依存文字を使わない
3. **細線禁止** - 線を使うなら太線のみ、または矩形背景でセクション分け
4. **最小フォント32px** - これを下回るテキストは存在してはならない
5. **安全領域7%** - 上下左右の7%に重要テキストを配置しない
6. **overflow自動検出→再分割** - はみ出したら枚数を増やして解決

## overflow自動修正フロー

```
1. Plannerの分割案でHTMLを生成
2. Playwrightでレンダリング
3. DOM検査: element.scrollHeight > element.clientHeight ?
4. Yes → items_per_slide を減らして該当カテゴリだけ再分割
5. 再レンダリング → 再検査（収束するまで繰り返し）
6. No → OK、PNG出力
```

## 入出力

| 入力 | 出力 |
|---|---|
| `SLIDE_DATA_PACK_V2.json` | `slide_001.png` ~ `slide_NNN.png` |
| スライド分割案 | `slides.zip` |
| HTMLテンプレート（`src/templates/`） | |

## テンプレート構成

| テンプレート | 用途 |
|---|---|
| `base.html` | 共通レイアウト（フォント読み込み、安全領域） |
| `title.html` | タイトルスライド |
| `shop-info.html` | 店情報スライド |
| `menu.html` | メニュースライド（2カラム対応） |
