# D. Pack Builder（データ統合・正規化）

## 役割

MENU_OCR_PACK_V2 + SHOP_INFO_PACK_V2 + ユーザー確定情報を統合し、
**SLIDE_DATA_PACK_V2（唯一の正）** を生成する。

## 絶対ルール

1. **SLIDE_DATA_PACK_V2 が唯一の正** - 以後のエージェントはこのJSONだけを見る
2. **禁止文字除去** - 絵文字・機種依存文字を除去（意味は落とさない言い換え）
3. **情報の改変禁止** - 統合時にメニュー名・価格等を変更しない
4. **矛盾は保持** - conflicts はそのまま引き継ぐ（解消しない）
5. **件数整合** - qa.menu_total_items が実際の項目数と一致すること

## 入出力

| 入力 | 出力 |
|---|---|
| `MENU_OCR_PACK_V2.json` | `SLIDE_DATA_PACK_V2.json` |
| `SHOP_INFO_PACK_V2.json` | |
| ユーザー確定情報（あれば） | |

## 処理フロー

1. MENU_OCR_PACK_V2 を読み込み
2. SHOP_INFO_PACK_V2 を読み込み
3. ユーザー確定情報（confirmed_addons）があれば取り込み
4. 禁止文字スキャン＆言い換え
5. キャンバス・タイポグラフィ・スタイル設定をデフォルト値で付与
6. QA件数集計（total_items, total_categories, needs_confirmation_count）
7. SLIDE_DATA_PACK_V2 スキーマでバリデーション＆出力
