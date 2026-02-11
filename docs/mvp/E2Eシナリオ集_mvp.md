# Mix Stud Online MVP E2Eシナリオ集

## 1. 目的

本ドキュメントは、`docs/mvp/詳細設計書_mvp.md` §15 を具体化した E2E テストシナリオ集である。  
実装前に「前提条件・入力（操作）・期待値」を固定し、テスト駆動で進めやすくすることを目的とする。

## 2. 参照仕様

- 要件定義: [要件定義書_mvp.md](./要件定義書_mvp.md)
- 詳細設計: [詳細設計書_mvp.md](./詳細設計書_mvp.md)
- HTTP契約: [openapi.yaml](./openapi.yaml)
- WebSocket契約: [asyncapi.yaml](./asyncapi.yaml)

## 3. 共通前提

1. テーブル設定は `smallBet=20`, `bigBet=40`, `ante=5`, `bringIn=10`, `maxPlayers=6` を用いる。
2. テストユーザー `U1..U6`（必要に応じて `U7`）を使用し、初期ウォレットは原則 `$4,000` とする。
3. 明示しない限り、対象テーブルは空席から開始し、`dealerSeatNo` はシナリオ前提に従って固定する。
4. ショーダウン強度/配当を検証するシナリオでは、デッキ順を固定可能なテストハーネス（実装方式は任意）を使用する。
5. WebSocket は `tableSeq` の単調増加とイベント順序を検証対象とする。
6. 期待値は、HTTPレスポンス・WebSocketイベント・最終状態（`/api/tables/:tableId`・履歴API）で確認する。

## 4. シナリオ一覧

| ID    | 区分          | 主題                                     |
| ----- | ------------- | ---------------------------------------- |
| HP-01 | ハッピーパス  | OAuthログイン〜ロビー〜卓詳細表示        |
| HP-02 | ハッピーパス  | 2人着席でハンド開始                      |
| HP-03 | ハッピーパス  | 途中参加は次ハンド有効化                 |
| HP-04 | ハッピーパス  | StudHi標準進行（Showdown/履歴整合）      |
| HP-05 | ハッピーパス  | 6ハンドごとのミックスローテーション      |
| HP-06 | ハッピーパス  | Stud8 Hi/Lo分割（両資格あり）            |
| HP-07 | ハッピーパス  | Stud8 Lo資格なし（Hi総取り）             |
| HP-08 | ハッピーパス  | 履歴API一覧/詳細（正常ページング）       |
| HP-09 | ハッピーパス  | 再接続resumeで差分追従                   |
| HP-10 | ハッピーパス  | スタック0で自動退席                      |
| HP-11 | ハッピーパス  | 再接続resumeでtable.snapshotフォールバック |
| HP-12 | ハッピーパス  | サーバー再起動後の進行中ハンド復元       |
| NG-01 | 異常系        | buy-in範囲外（下限/上限）                |
| NG-02 | 異常系        | ウォレット不足で着席拒否                 |
| NG-03 | 異常系        | 卓満席で着席拒否                         |
| NG-04 | 異常系        | 非手番アクション拒否                     |
| NG-05 | 異常系        | toCallありでCHECK拒否                    |
| NG-06 | 異常系        | 4th以降のCOMPLETE拒否                    |
| NG-07 | 異常系        | マルチウェイ5bet cap超過raise拒否        |
| NG-08 | 異常系        | 履歴cursor改ざん（INVALID_CURSOR）       |
| NG-09 | 異常系        | 認証期限切れWS（AUTH_EXPIRED）           |
| NG-10 | 異常系        | 切断放置で自動行動/3連続切断LEAVE        |
| NG-11 | 異常系        | table.snapshot必須キー欠落は検証失敗     |
| ED-01 | 境界値/エッジ | StudHi/Stud8のBring-inスートタイブレーク |
| ED-02 | 境界値/エッジ | RazzのBring-inスートタイブレーク         |
| ED-03 | 境界値/エッジ | Bring-in不足時のAll-in                   |
| ED-04 | 境界値/エッジ | 3人1サイドポット分配                     |
| ED-05 | 境界値/エッジ | 4人多段サイドポット分配                  |
| ED-06 | 境界値/エッジ | Stud8でポット単位独立Hi/Lo評価           |
| ED-07 | 境界値/エッジ | Stud8のオッドチップ（Hi優先）            |
| ED-08 | 境界値/エッジ | 同側複数勝者オッドチップ（dealer起点）   |
| ED-09 | 境界値/エッジ | 全員All-inランアウト遷移                 |
| ED-10 | 境界値/エッジ | UNCONTESTED終局（ShowdownEventなし）     |
| ED-11 | 境界値/エッジ | ヘッズアップ時5bet cap解除               |

## 5. シナリオ詳細

### HP-01 OAuthログイン〜ロビー〜卓詳細表示

- 前提条件: 未ログインユーザー `U1` がブラウザ初回アクセス。
- 入力（操作）:
1. `GET /api/auth/google/start`
2. 正常な `code/state` で `GET /api/auth/google/callback`
3. `GET /api/auth/me`
4. `GET /api/lobby/tables`
5. `GET /api/tables/{tableId}`
- 期待値:
1. 手順1は `302` で Google OAuth へ遷移。
2. 手順2は `302` で `Set-Cookie` を返し、ロビーへリダイレクト。
3. 手順3は `200`、`user` と `walletBalance` を返す。
4. 手順4は `200`、2卓分の `tableId/tableName/stakes/players/maxPlayers/gameType/emptySeats` を返す。
5. 手順5は `200`、`stakes` と `seats` と `currentHand` を返す（未進行時 `currentHand` は `null` 可）。

### HP-02 2人着席でハンド開始

- 前提条件: 空席テーブル。`U1`,`U2` のウォレット残高は各 `$1000` 以上。
- 入力（操作）:
1. `U1` が `table.join`（`buyIn=1000`）を送信。
2. `U2` が `table.join`（`buyIn=1000`）を送信。
3. WebSocketイベントをハンド開始まで受信。
- 期待値:
1. 両者に `SeatStateChangedEvent(reason=JOIN)` が配信され、席状態が `ACTIVE` になる。
2. 2人が `ACTIVE` かつ `stack >= ante` を満たした時点でハンド開始する。
3. `DealInitEvent` → `PostAnteEvent` → `DealCards3rdEvent` が順序通り配信される。
4. `PostAnteEvent` 後のポットは `$10`、両者スタックは `$995`。

### HP-03 途中参加は次ハンド有効化

- 前提条件: `U1`,`U2` でハンド進行中（4th Street）。
- 入力（操作）:
1. `U3` がハンド進行中に `table.join`（`buyIn=500`）を送信。
2. 現在ハンド終了まで観測。
3. 次ハンド開始を観測。
- 期待値:
1. `U3` の席状態は即時 `SEATED_WAIT_NEXT_HAND` になる。
2. 現在ハンド中の `DealCardEvent/ShowdownEvent` に `U3` の配札は含まれない。
3. 次ハンド開始時に `SeatStateChangedEvent(reason=NEXT_HAND_ACTIVATE)` で `ACTIVE` 化される。
4. `U3` は次ハンドの `PostAnteEvent` と `DealCards3rdEvent` から参加する。

### HP-04 StudHi標準進行（Showdown/履歴整合）

- 前提条件:
1. `gameType=STUD_HI`。
2. 2人卓（`S1=U1`,`S2=U2`）で開始スタックは各 `$200`。
3. デッキ固定で `S1` が勝者となる配牌。
- 入力（操作）:
1. 3rd: `S1 bring-in 10`, `S2 complete 20`, `S1 call 10`
2. 4th: `check/check`
3. 5th: `S2 bet 40`, `S1 call 40`
4. 6th: `check/check`
5. 7th: `check/check` でショーダウン
6. ハンド終了後に `GET /api/history/hands` と `GET /api/history/hands/{handId}`
- 期待値:
1. イベント順は `BringInEvent` → `CompleteEvent` → `CallEvent` を含み、順序逆転がない。
2. 最終ポットは `$130`、`DealEndEvent(endReason=SHOWDOWN)`。
3. 最終スタックは `S1=265`, `S2=135`（net: `+65/-65`）。
4. 履歴詳細に `streetActions(THIRD..SEVENTH)`、`showdown`、`profitLoss` が保存される。

### HP-05 6ハンドごとのミックスローテーション

- 前提条件: 対象テーブルの `gameType=STUD_HI`、`handsSinceRotation=5`。
- 入力（操作）:
1. 1ハンドを通常完了まで進行させる。
2. 次ハンドの `DealInitEvent` を観測。
- 期待値:
1. 該当ハンドの `DealEndEvent` で `nextGameType=RAZZ`、`handsSinceRotation=0`。
2. 次ハンド `DealInitEvent` の `gameType` は `RAZZ`。
3. 同時に `mixIndex` が `+1 mod 3` で更新される。

### HP-06 Stud8 Hi/Lo分割（両資格あり）

- 前提条件:
1. `gameType=STUD_8`。
2. 2人卓（`S1`,`S2`）で開始スタック各 `$200`。
3. デッキ固定で `S1` がHi、`S2` がLo勝利（Lo資格あり）。
- 入力（操作）:
1. 3rd: `S1 bring-in 10`, `S2 complete 20`, `S1 call 10`
2. 4th〜7thは全員チェックで進行
- 期待値:
1. 最終ポット `$50`（内訳: `ante $10 + 3rd betting $40`）。
2. `ShowdownEvent.potResults` に `potNo=1 side=HI amount=25`（winner `S1`）と `potNo=1 side=LO amount=25`（winner `S2`）が出る。
3. 最終スタックは `S1=200`, `S2=200`。

### HP-07 Stud8 Lo資格なし（Hi総取り）

- 前提条件:
1. `gameType=STUD_8`。
2. 2人卓で開始スタック各 `$200`。
3. デッキ固定でLo資格者が不在。
- 入力（操作）:
1. HP-06 と同じベッティングで最終ポット `$50` を形成。
- 期待値:
1. Lo側配当は生成されない（`side=LO` の結果なし）。
2. Hi勝者が `$50` を総取りする。
3. 例として `S1` 勝利時、最終スタックは `S1=225`, `S2=175`。

### HP-08 履歴API一覧/詳細（正常ページング）

- 前提条件: `U1` に3件以上の履歴ハンドが存在。
- 入力（操作）:
1. `GET /api/history/hands?limit=2`
2. 手順1で返った `nextCursor` を使い `GET /api/history/hands?cursor={nextCursor}&limit=2`
3. 先頭ハンドの `handId` で `GET /api/history/hands/{handId}`
- 期待値:
1. 一覧は `endedAt DESC, handId DESC` の順で返る。
2. 1ページ目と2ページ目で重複レコードがない。
3. 詳細レスポンスは `gameType/participants/streetActions/showdown/profitLoss` を含む。

### HP-09 再接続resumeで差分追従

- 前提条件:
1. `U1` は `tableSeq=150` まで受信済み。
2. 切断中に卓側で `tableSeq=151..155` が進行。
- 入力（操作）:
1. `U1` 再接続後に `table.resume(lastTableSeq=150)` を送信。
- 期待値:
1. `table.event` が `151..155` の連番で再送される。
2. 差分が取得可能なため `table.snapshot` は返らない。
3. 以降のリアルタイムイベントも連番で継続受信できる。

### HP-10 スタック0で自動退席

- 前提条件:
1. 3人卓で `S3` 開始スタックが `$30`。
2. 当該ハンドで `S3` が全額投入して敗北する配牌。
- 入力（操作）:
1. ハンドを終局まで進行。
2. 終了後に `GET /api/tables/{tableId}` とロビー一覧を取得。
- 期待値:
1. `S3` のハンド終了時スタックが `0`。
2. `SeatStateChangedEvent(reason=AUTO_LEAVE_ZERO_STACK)` で `S3` の席が解放される。
3. ロビーの `players` が 1 減少して反映される。

### HP-11 再接続resumeでtable.snapshotフォールバック

- 前提条件:
1. `U1` は `tableSeq=120` まで受信済み。
2. サーバー側は差分保持範囲を超えており、`121..` の差分再送ができない。
- 入力（操作）:
1. `U1` 再接続後に `table.resume(lastTableSeq=120)` を送信。
2. `table.snapshot` を受信。
- 期待値:
1. サーバーは `table.snapshot`（`payload.reason=OUT_OF_RANGE` または `RESYNC_REQUIRED`）を返す。
2. `payload.table` は AsyncAPI `SnapshotTable` の必須キーを満たす。
3. クライアントは `table.snapshot.tableSeq` を基準にローカル状態を再構築し、その後の `table.event` を連番で継続受信できる。

### HP-12 サーバー再起動後の進行中ハンド復元

- 前提条件:
1. 進行中ハンドが存在し、`hands.status=IN_PROGRESS`。
2. 直近イベントが `hand_events` に永続化済み（例: 5th Street の途中）。
- 入力（操作）:
1. ゲームサーバーを再起動する。
2. 再起動後、同卓のクライアントを再接続し `table.resume` を送信。
- 期待値:
1. サーバー起動時に `IN_PROGRESS` ハンドがリプレイされ、手番・ポット・ストリートが再現される。
2. 再起動前後で `tableSeq` の順序整合が保たれ、重複・逆転配信がない。
3. 復元後もハンドを通常終局まで進行でき、`DealEndEvent` と履歴APIの結果が整合する。

### NG-01 buy-in範囲外（下限/上限）

- 前提条件: `U1` は未着席。
- 入力（操作）:
1. `table.join(buyIn=399)` を送信。
2. `table.join(buyIn=2001)` を送信。
- 期待値:
1. 両ケースで `table.error(code=BUYIN_OUT_OF_RANGE)`。
2. 席状態は `EMPTY` のまま。
3. ウォレット残高に変動なし。

### NG-02 ウォレット不足で着席拒否

- 前提条件: `U1.walletBalance=300`、未着席。
- 入力（操作）:
1. `table.join(buyIn=400)` を送信。
- 期待値:
1. `table.error(code=INSUFFICIENT_CHIPS)` を返す。
2. 席は確保されず、`table_seats` は変化しない。

### NG-03 卓満席で着席拒否

- 前提条件: 対象卓の6席すべて `ACTIVE`。
- 入力（操作）:
1. `U7` が `table.join(buyIn=500)` を送信。
- 期待値:
1. `table.error(code=TABLE_FULL)` を返す。
2. 既存6席の状態・スタックに変化なし。

### NG-04 非手番アクション拒否

- 前提条件: `nextToActSeatNo=S1` の状態。
- 入力（操作）:
1. `S2` が `table.act(action=CALL)` を送信。
- 期待値:
1. `table.error(code=NOT_YOUR_TURN)` を返す。
2. ポット・`nextToActSeatNo`・ストリート進行に変化なし。

### NG-05 toCallありでCHECK拒否

- 前提条件: 現手番プレイヤーに `toCall=20` が存在。
- 入力（操作）:
1. 手番プレイヤーが `table.act(action=CHECK)` を送信。
- 期待値:
1. `table.error(code=INVALID_ACTION)` を返す。
2. `CheckEvent` は発生しない。
3. 手番と `streetBetTo` は据え置き。

### NG-06 4th以降のCOMPLETE拒否

- 前提条件: ストリートが `FOURTH`。
- 入力（操作）:
1. 手番プレイヤーが `table.act(action=COMPLETE, amount=20)` を送信。
- 期待値:
1. `table.error(code=INVALID_ACTION)` を返す。
2. ストリート遷移やポット額に副作用がない。

### NG-07 マルチウェイ5bet cap超過raise拒否

- 前提条件:
1. 3人以上がアクティブ。
2. 当該ストリートで既に `1bet + 4raise`（5bet）に到達済み。
- 入力（操作）:
1. 次プレイヤーがさらに `table.act(action=RAISE)` を送信。
- 期待値:
1. `table.error(code=INVALID_ACTION)` を返す。
2. `RaiseEvent` は追加されず、`streetBetTo` は変わらない。

### NG-08 履歴cursor改ざん（INVALID_CURSOR）

- 前提条件: `U1` 認証済み。
- 入力（操作）:
1. `GET /api/history/hands?cursor=tampered-token` を呼ぶ。
- 期待値:
1. HTTP `400` を返す。
2. `error.code=INVALID_CURSOR` を返す。

### NG-09 認証期限切れWS（AUTH_EXPIRED）

- 前提条件: セッション期限切れ状態。
- 入力（操作）:
1. WebSocket接続後に任意コマンド（例: `ping` または `table.resume`）を送信。
- 期待値:
1. `table.error(code=AUTH_EXPIRED)` となる。
2. 仕様に従い `requestId` / `tableId` が `null` の場合を許容する。
3. 卓状態は不変。

### NG-10 切断放置で自動行動/3連続切断LEAVE

- 前提条件:
1. `S2` は `DISCONNECTED`、`disconnectStreak=2`。
2. 今ハンドで `S2` に手番が回る。
- 入力（操作）:
1. `S2` を再接続させず手番タイムアウトさせる。
2. ハンド終了まで進行。
- 期待値:
1. タイムアウト時、`toCall=0` なら `CheckEvent`、`toCall>0` なら `FoldEvent`、Bring-in局面なら `BringInEvent` が自動発行される。
2. タイムアウト起因で発行された `CheckEvent` / `FoldEvent` は `payload.isAuto=true` である。
3. ハンド終了時に `disconnectStreak=3` となり、席が自動解放される。
4. 次ハンド開始時、`S2` は参加しない。

### NG-11 table.snapshot必須キー欠落は検証失敗

- 前提条件:
1. `U1` は `tableSeq=150` まで受信済み。
2. 差分保持外のため、`table.resume(lastTableSeq=150)` への応答は `table.snapshot` になる。
3. テストハーネスで不正スナップショット（例: `payload.table.currentHand` 欠落）を注入できる。
- 入力（操作）:
1. `U1` が再接続して `table.resume(lastTableSeq=150)` を送信。
2. 必須キー欠落の `table.snapshot` を受信させる。
- 期待値:
1. 受信スキーマ検証で失敗し、クライアントは当該 `table.snapshot` を状態へ適用しない。
2. クライアントは再同期失敗として内部エラーを記録する（例: `SNAPSHOT_SCHEMA_INVALID`）。
3. 破損スナップショット受信後も、既存ローカル状態は不正値で上書きされない。

### ED-01 StudHi/Stud8のBring-inスートタイブレーク

- 前提条件:
1. `gameType` は `STUD_HI` または `STUD_8`。
2. 2人卓で両者ともペア無し、Upcardランク同一（`A`）。
3. Upcard は `S1=Ah`, `S2=As`。
- 入力（操作）:
1. 3rd配札まで進行。
- 期待値:
1. `DealCards3rdEvent.bringInSeatNo` は `S1`。
2. スート優先 `Spade > Heart > Diamond > Club` の「弱い側」がBring-in対象になる。

### ED-02 RazzのBring-inスートタイブレーク

- 前提条件:
1. `gameType=RAZZ`。
2. 2人卓で両者ペア無し、Upcardランク同一（`A`）。
3. Upcard は `S1=As`, `S2=Ah`。
- 入力（操作）:
1. 3rd配札まで進行。
- 期待値:
1. `DealCards3rdEvent.bringInSeatNo` は `S1`（Spade側）。
2. Razzスート優先 `Club > Diamond > Heart > Spade` に基づき、弱い側がBring-inになる。

### ED-03 Bring-in不足時のAll-in

- 前提条件:
1. 2人卓で `S1` スタック `$8`、`S2` スタック `$200`。
2. `S1` がBring-in対象。
- 入力（操作）:
1. `PostAnteEvent` 後（`S1` は `$3` 残り）にBring-in処理を進行。
- 期待値:
1. `BringInEvent.amount=3`、`isAllIn=true`、`stackAfter=0`。
2. ポットは ante `$10` + bring-in `$3` = `$13`。
3. `S1` は以降アクション不可でショーダウン待ちになる。

### ED-04 3人1サイドポット分配

- 前提条件:
1. `gameType=STUD_HI`、3人卓。
2. 開始スタック: `S1=60`, `S2=140`, `S3=300`。
3. 最終拠出合計が `S1=60`, `S2=140`, `S3=140` になるよう進行。
4. ショーダウン強度は `S1 > S3 > S2`。
- 入力（操作）:
1. 全員オールイン相当まで進行しショーダウン。
- 期待値:
1. メインポット `180`（60x3）を `S1` が獲得。
2. サイドポット `160`（(140-60)x2）を `S3` が獲得。
3. 最終スタックは `S1=180`, `S2=0`, `S3=320`。

### ED-05 4人多段サイドポット分配

- 前提条件:
1. `gameType=STUD_HI`、4人卓。
2. 開始スタック: `S1=80`, `S2=140`, `S3=220`, `S4=300`。
3. 最終拠出合計: `80/140/220/220`。
4. 勝敗順（ポット別）: メイン `S1`、サイド1 `S2`、サイド2 `S4`。
- 入力（操作）:
1. 拠出額が前提値になるよう進行しショーダウン。
- 期待値:
1. ポット内訳は `320`（メイン）, `180`（サイド1）, `160`（サイド2）。
2. 分配結果は `S1=320`, `S2=180`, `S4=160`（`S3` は獲得なし）。
3. 最終スタックは `S1=320`, `S2=180`, `S3=0`, `S4=240`。

### ED-06 Stud8でポット単位独立Hi/Lo評価

- 前提条件:
1. `gameType=STUD_8`、3人卓。
2. 開始スタック: `S1=80`, `S2=160`, `S3=300`。
3. 最終拠出合計: `S1=80`, `S2=160`, `S3=160`（メイン+1サイド）。
4. メインポットは `Hi=S3`, `Lo=S1`、サイドポットは `Hi=S2`（Lo資格者なし）。
- 入力（操作）:
1. 前提どおりの勝敗になる配牌でショーダウン。
- 期待値:
1. メイン `240` は `HI 120` と `LO 120` に分割。
2. サイド `160` は `HI` 単独配当（`LO` 配当なし）。
3. 最終スタックは `S1=120`, `S2=160`, `S3=260`。

### ED-07 Stud8のオッドチップ（Hi優先）

- 前提条件:
1. `gameType=STUD_8`、3人卓。
2. 最終ポットが奇数の `$55`。
3. `Hi=S1`, `Lo=S2`。
- 入力（操作）:
1. ポット `$55` でショーダウン発生まで進行。
- 期待値:
1. 分割時の1チップ余りは先にHi側へ配分される。
2. 配当は `S1(HI)=28`, `S2(LO)=27`。
3. `potResults` でも `HI` 配当が `LO` より1大きい。

### ED-08 同側複数勝者オッドチップ（dealer起点）

- 前提条件:
1. `gameType=STUD_HI`、`dealerSeatNo=2`。
2. 最終ポットは奇数の `$55`。
3. Hi同着勝者は `S1` と `S3`。
- 入力（操作）:
1. `S1` と `S3` が同着になる配牌でショーダウン。
- 期待値:
1. 等分基準は `27` ずつ、余り `1` が発生。
2. 余り1チップは `dealerSeatNo` から時計回りで先に現れる勝者 `S3` に配分される。
3. 配当は `S3=28`, `S1=27`。

### ED-09 全員All-inランアウト遷移

- 前提条件: 3人卓で4th時点までに全員 `ALL_IN` となる。
- 入力（操作）:
1. アクション不能状態（全員all-in）を作る。
2. 7thまで自動進行させる。
- 期待値:
1. 以降の `StreetAdvanceEvent.reason` は `ALL_IN_RUNOUT`。
2. `DealCardEvent` で4th〜7thが順次配札される。
3. 最終的に `ShowdownEvent` → `DealEndEvent` が配信される。

### ED-10 UNCONTESTED終局（ShowdownEventなし）

- 前提条件: 3人卓、3rdでBring-in後に他2人がfoldする流れ。
- 入力（操作）:
1. 3rdで `S1 bring-in 10`。
2. `S2 fold`, `S3 fold`。
- 期待値:
1. `StreetAdvanceEvent.reason=HAND_CLOSED` で終局へ遷移する。
2. `ShowdownEvent` は配信されない。
3. `DealEndEvent.endReason=UNCONTESTED`。
4. 例として最終ポット `$25`（ante15+bring-in10）を `S1` が獲得する。

### ED-11 ヘッズアップ時5bet cap解除

- 前提条件:
1. `gameType=STUD_HI`、2人卓（ヘッズアップ）。
2. 対象ストリートで `1bet + 4raise`（5bet）到達後も両者が継続可能なスタックを保持。
- 入力（操作）:
1. 同一ストリートで6回目以降の `RAISE` を送信する。
2. その後 `CALL` まで進行する。
- 期待値:
1. `table.error(code=INVALID_ACTION)` は返らず、6回目以降の `RaiseEvent` が受理される。
2. `streetBetTo` は追加raise分だけ更新される。
3. 同条件を3人以上卓で実施した場合は `INVALID_ACTION` となり、ヘッズアップ時のみ cap解除が有効であることを確認できる。

## 6. 補足（運用上の推奨）

1. シナリオIDをそのままE2Eテスト名（`describe/it`）に採用する。
2. `HP -> NG -> ED` の順で段階的にCIへ導入し、失敗時の切り分けを容易にする。
3. 配当検証シナリオ（ED-04〜ED-08）は、`potResults` と最終スタックの両方を必ず照合する。

## 7. テスト基盤（M0-04）

- unit テスト:
  - `apps/server/src/__tests__/unit/`
- integration テスト:
  - `apps/server/src/__tests__/integration/`
- e2e テスト:
  - `apps/server/src/__tests__/e2e/`
- 固定デッキハーネス:
  - `apps/server/src/testing/fixed-deck-harness.ts`
- テストデータ初期化:
  - `apps/server/src/testing/test-data-seed.ts`
- シナリオID固定一覧:
  - `apps/server/src/testing/e2e-scenarios.ts`
