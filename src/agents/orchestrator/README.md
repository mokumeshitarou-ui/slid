# A. Orchestrator（司令塔）

## 役割

パイプライン全体の実行制御とDiscord連携を担当する。

## 責務

- Discordイベント受信（スレッド内の画像添付 / スラッシュコマンド）
- スレッド内の添付画像を収集し、重複排除
- `run_id` を発行し、成果物を `runs/{run_id}/` に紐づけ保存
- 各エージェントを順番に呼び出し、パイプラインを実行
- 進捗メッセージをDiscordスレッドに投稿
- エラー発生時のリトライ制御・ユーザー通知

## 実行順序

```
1. 画像収集（Discord添付から）
2. OCR Extractor → MENU_OCR_PACK_V2
3. Web Researcher → SHOP_INFO_PACK_V2
4. Pack Builder → SLIDE_DATA_PACK_V2
5. Slide Planner → スライド分割案
6. Renderer → PNG連番
7. QA / Validator → 検証結果
8. Discord報告（ZIP + QA要約 + 要確認リスト）
```

## 入出力

| 入力 | 出力 |
|---|---|
| Discordスレッド（画像添付） | `runs/{run_id}/` 以下に全成果物 |
| スラッシュコマンド | Discord投稿（ZIP, QA要約） |

## Discordコマンド

| コマンド | 動作 |
|---|---|
| `/run` | スレッドの画像で一括実行 |
| `/status` | 現在の抽出件数・要確認・矛盾・最終更新 |
| `/confirm` | 店確認済み情報を追加 |
| `/render` | データパックから再レンダリング |
