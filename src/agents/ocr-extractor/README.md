# B. OCR Extractor（OCR抽出）

## 役割

メニュー画像からテキストを抽出し、MENU_OCR_PACK_V2 を生成する。

## 使用API

- **Gemini API**（Vision機能でメニュー画像を解析）

## 絶対ルール

1. **原文厳守** - メニュー名・価格・注記はすべて画像に書かれているままを記録する
2. **推測禁止** - 読めない文字を勝手に補完しない
3. **解釈禁止** - price_text は "800円(税込)" 等そのまま記録（数値変換しない）
4. **カテゴリ原文** - メニュー表に書かれたカテゴリ名をそのまま使う（再分類禁止）
5. **読めない箇所** → `needs_confirmation` に積む

## 入出力

| 入力 | 出力 |
|---|---|
| メニュー画像（複数） | `MENU_OCR_PACK_V2.json` |

## 処理フロー

1. 画像を1枚ずつGemini APIに送信
2. カテゴリ・メニュー名・価格・注記を構造化抽出
3. 各項目に evidence（元画像, 位置ヒント）と confidence を付与
4. 読めない箇所を needs_confirmation に記録
5. counts（total_categories, total_items）を集計
6. MENU_OCR_PACK_V2 スキーマに合わせてJSON出力
