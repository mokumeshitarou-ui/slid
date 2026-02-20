# C. Web Researcher（Web調査）

## 役割

店舗の基本情報をWebから収集し、SHOP_INFO_PACK_V2 を生成する。

## 使用API

- **Perplexity API**（Web検索・要約）
- **OpenAI API**（補助、必要な場合のみ）

## 絶対ルール

1. **メニュー情報は原則収集しない** - 事故防止（メニューはOCRから取得）
2. **根拠URL必須** - すべての情報に情報源URLを付ける
3. **最低2ソース照合** - 1ソースだけで断定しない
4. **矛盾は断定禁止** - 情報が食い違う場合は conflicts に併記
5. **推測禁止** - 見つからなかった情報は null にする

## 収集対象

| フィールド | 説明 |
|---|---|
| name | 店名 |
| address | 住所 |
| access | アクセス（最寄り駅・徒歩時間等） |
| hours | 営業時間 |
| closed_days | 定休日 |
| phone | 電話番号 |
| payment | 支払い方法 |
| parking | 駐車場情報 |
| seats | 座席数 |
| official_links | 公式サイト・SNS |

## 入出力

| 入力 | 出力 |
|---|---|
| 店名（＋エリア等のヒント） | `SHOP_INFO_PACK_V2.json` |

## 処理フロー

1. 店名でWeb検索（公式サイト、Google Business Profile、食べログ等）
2. 各ソースから基本情報を抽出
3. 2ソース以上で照合、矛盾があれば conflicts に記録
4. slide_copy（スライド表示用短縮テキスト）を生成
5. sources に使用した全URLを記録
6. SHOP_INFO_PACK_V2 スキーマに合わせてJSON出力
