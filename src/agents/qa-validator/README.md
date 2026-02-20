# G. QA / Validator（品質検証）

## 役割

レンダリング結果を検証し、品質基準を満たしているか機械チェックする。

## 必須チェック項目

### 1. 全メニュー掲載チェック
- `SLIDE_DATA_PACK_V2.qa.menu_total_items` とスライド上の掲載数が一致
- 1件でも不足があれば **FAIL**

### 2. 最小フォント遵守チェック
- スライド上に 32px 未満のテキストが存在しないこと
- 違反があれば **FAIL**（小さくする代わりに分割）

### 3. 禁止表現チェック
- 根拠なし「おすすめ」「人気」「食べ方」等の断定が混入していないこと
- 検出されたら **FAIL**

### 4. 禁止文字チェック
- 絵文字・機種依存文字・特殊アイコン文字が含まれていないこと
- 検出されたら **FAIL**

### 5. conflicts表示チェック
- 矛盾情報がある場合、注意枠で併記されていること

### 6. needs_confirmation チェック
- 要確認項目がある場合、リスト化されていること

### 7. overflow チェック
- レンダリング後のDOMで scrollHeight > clientHeight の要素がないこと
- 検出されたら Renderer に再分割を要求

## 出力

### RUN_REPORT.md

```markdown
# QA Report - {run_id}

## 結果: PASS / FAIL

## チェック結果
| 項目 | 結果 | 詳細 |
|---|---|---|
| 全メニュー掲載 | PASS/FAIL | {total}件中{found}件掲載 |
| 最小フォント | PASS/FAIL | 最小{N}px |
| 禁止表現 | PASS/FAIL | {検出内容} |
| 禁止文字 | PASS/FAIL | {検出内容} |
| overflow | PASS/FAIL | {検出箇所} |

## 要確認項目
- {needs_confirmation の内容}

## 矛盾情報
- {conflicts の内容}

## ソース一覧
- {sources の内容}
```

## 入出力

| 入力 | 出力 |
|---|---|
| `SLIDE_DATA_PACK_V2.json` | `RUN_REPORT.md` |
| レンダリング済みPNG / DOM | QA結果（PASS/FAIL + 詳細） |
