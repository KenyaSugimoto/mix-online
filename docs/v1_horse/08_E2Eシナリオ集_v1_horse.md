# Mix Online v1 HORSE E2Eシナリオ集

> 作成日: 2026-02-13 ｜ 対象バージョン: v1 ｜ ステータス: Draft

## 1. 目的

v1 HORSE 対応の回帰防止と品質ゲートとして、検証シナリオを定義する。

## 2. 参照仕様

- `./01_要件定義_v1_horse.md`
- `./02_ゲームルール仕様_horse.md`
- `./03_ローテーション・テーブル進行.md`
- `./openapi.v1_horse.yaml`
- `./asyncapi.v1_horse.yaml`

## 3. 共通前提

- 6-max テーブル
- `FIXED_LIMIT`
- HORSE ローテーション（6ハンド単位）
- テスト用固定デッキを使い、勝者とランアウトを再現可能にする

### 3.1 共通テストデータ

| 項目    | 値                                         |
| ------- | ------------------------------------------ |
| tableId | `11111111-1111-1111-1111-111111111111`     |
| users   | 4人（seatNo 1..4）                         |
| buyIn   | 各 1000（初期スタック = buyIn 額）         |
| stakes  | smallBet=20, bigBet=40, ante=5, bringIn=10 |

## 4. シナリオ一覧

| ID    | 区分         | シナリオ                       |
| ----- | ------------ | ------------------------------ |
| HP-01 | ハッピーパス | ログイン〜着席〜ハンド開始     |
| HP-02 | ハッピーパス | HOLD_EM 標準進行               |
| HP-03 | ハッピーパス | OMAHA_8 Hi/Lo 両成立           |
| HP-04 | ハッピーパス | RAZZ 標準進行                  |
| HP-05 | ハッピーパス | STUD_HI 標準進行               |
| HP-06 | ハッピーパス | STUD_8 Lo 不成立               |
| HP-07 | ハッピーパス | 30ハンド連続で HORSE 回転維持  |
| NG-01 | 異常系       | 非手番アクション拒否           |
| NG-02 | 異常系       | toCall あり CHECK 拒否         |
| NG-03 | 異常系       | cap 超過 RAISE 拒否            |
| NG-04 | 異常系       | cursor 改ざんで INVALID_CURSOR |
| NG-05 | 異常系       | 認証期限切れ WS                |
| ED-01 | 境界値       | OMAHA_8 で Lo 片側不成立       |
| ED-02 | 境界値       | RAZZ bring-in タイブレーク     |
| ED-03 | 境界値       | STUD_8 odd chip                |
| ED-04 | 境界値       | Flop 系 all-in ランアウト      |
| ED-05 | 境界値       | 再接続 snapshot 復元           |

## 5. 重点シナリオ詳細

### HP-02 HOLD_EM 標準進行

前提データ:
- `gameType=HOLD_EM`, `mixIndex=0`, `handsSinceRotation=0`
- 4人着席済み、全員 `ACTIVE`

手順:
1. `GET /v1/tables/{tableId}` で卓情報を取得。
2. `table.join` 完了済みの4人でハンド開始を待つ。
3. 各 street で合法アクションのみ実行して showdown まで進行。
4. `GET /v1/hand-histories/{handId}` を取得。

期待Realtimeイベント列（主要、順序）:
1. `DealInitEvent`
2. `PostSmallBlindEvent`
3. `PostBigBlindEvent`
4. `DealHoleCardsEvent`（各プレイヤーへ hole 2枚）
5. PRE_FLOP: プレイヤーアクションイベント（`BetEvent` / `CallEvent` / `FoldEvent` / `RaiseEvent` 等）
6. `DealBoardFlopEvent`
7. `StreetAdvanceEvent`（`PRE_FLOP->FLOP`）
8. FLOP: プレイヤーアクションイベント
9. `DealBoardTurnEvent`
10. `StreetAdvanceEvent`（`FLOP->TURN`）
11. TURN: プレイヤーアクションイベント
12. `DealBoardRiverEvent`
13. `StreetAdvanceEvent`（`TURN->RIVER`）
14. RIVER: プレイヤーアクションイベント
15. `ShowdownEvent`
16. `DealEndEvent`

期待結果:
- `openapi.v1_horse.yaml` の `HoldemDetail` 形式で履歴詳細が取得できる。
- `boardCards` が 5 枚であり、`streetActions` が欠落しない。

### HP-03 OMAHA_8 Hi/Lo 両成立

前提データ:
- `gameType=OMAHA_8`, `mixIndex=1`, `handsSinceRotation=0`
- 固定デッキで Hi/Lo 両側に勝者が出る構成

手順:
1. ハンドを開始し、showdown まで進行。
2. `GET /v1/hand-histories/{handId}` を取得。

期待Realtimeイベント列（主要）:
1. `DealInitEvent`
2. `DealBoardFlopEvent`
3. `DealBoardTurnEvent`
4. `DealBoardRiverEvent`
5. `ShowdownEvent`
6. `DealEndEvent`

期待結果:
- `showdown.highShares` と `showdown.lowShares` が両方存在する。
- `Omaha8Detail.lowQualified=true`。
- `participants[].resultDelta` の合計が 0。

### HP-07 30ハンド連続で HORSE 回転維持

前提データ:
- 4人着席で自動進行可能
- 各ハンドで fold 完了できる短経路を利用

手順:
1. 30 ハンドを連続実行。
2. 各 `DealInitEvent` 時点の `gameType` / `mixIndex` を記録。

期待結果:
- 6 ハンドごとに `gameType` が切替。
- `mixIndex` が `0->1->2->3->4->0` を維持。
- 30 ハンド終了時に `mixIndex=0`, `handsSinceRotation=0`。

### ED-05 再接続 snapshot 復元

前提データ:
- ハンド進行中に seatNo=3 のクライアントを切断可能

手順:
1. ハンド中盤で接続を切断。
2. 再接続後 `table.resume` を `lastTableSeq` 付きで送信。
3. `table.snapshot` と続く差分 `table.event` を適用。
4. `GET /v1/tables/{tableId}` で最終整合確認。

期待Realtimeイベント列（再接続後）:
1. `table.snapshot`
2. 必要に応じて欠落分 `table.event`（0件以上）

期待結果:
- `snapshot.payload.currentHand` と HTTP `currentHand` の `gameType/street/potSize` が一致。
- `toActSeatNo` と `actionDeadlineAt` が矛盾しない。

## 6. 異常系の期待エラー

| ID    | 期待エラー       |
| ----- | ---------------- |
| NG-01 | `NOT_YOUR_TURN`  |
| NG-02 | `INVALID_ACTION` |
| NG-03 | `INVALID_ACTION` |
| NG-04 | `INVALID_CURSOR` |
| NG-05 | `AUTH_EXPIRED`   |

## 7. 実装時チェックリスト

- scenario ごとに「前提データ」「イベント順」「期待HTTPレスポンス」を fixture 化する。
- ルール変更時は affected scenario の期待イベント列を更新する。
- バグ再発時は最小再現シナリオを本書へ追加する。
