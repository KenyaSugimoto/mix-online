# Mix Stud Online 状態遷移図（MVP）

Version: v1.0  
Last Updated: 2026-02-10  
参照要件: [`要件定義書_mvp.md`](./要件定義書_mvp.md)  
参照設計: [`詳細設計書_mvp.md`](./詳細設計書_mvp.md)  
契約仕様: [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml)  
DDL: [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql)  

---

## 1. 本書の位置づけ

- 本書は `docs/mvp` 配下の仕様から状態遷移を図式化した補助資料です。
- enum定義は `openapi.yaml` / `asyncapi.yaml` / `supabase/migrations/20260211190000_create_tables.sql` を正とします。
- 遷移条件は `詳細設計書_mvp.md` の `4.2`, `5.1`, `5.5`, `5.6`, `7.3.1`, `10.2`, `10.3` を基準に整理しています。

---

## 2. テーブル状態遷移 (`tables.status`)

```mermaid
stateDiagram-v2
  [*] --> WAITING: テーブル初期化

  WAITING --> DEALING: ハンド開始条件成立\nACTIVE>=2 かつ 全員stack>=ante

  DEALING --> BETTING: DealCards3rd/PostAnte/BringIn 完了\n最初の手番確定

  BETTING --> BETTING: StreetAdvanceEvent\nreason=BETTING_ROUND_COMPLETE\ntoStreet!=null / tableStatus=BETTING
  BETTING --> SHOWDOWN: StreetAdvanceEvent\ntableStatus=SHOWDOWN\n(reason=BETTING_ROUND_COMPLETE or ALL_IN_RUNOUT)
  BETTING --> HAND_END: StreetAdvanceEvent\nreason=HAND_CLOSED / tableStatus=HAND_END

  SHOWDOWN --> HAND_END: DealEndEvent\nendReason=SHOWDOWN or AUTO_END

  HAND_END --> DEALING: 次ハンド開始条件成立
  HAND_END --> WAITING: ACTIVE不足 または ante不足者あり
```

---

## 3. 席状態遷移 (`table_seats.status`)

```mermaid
stateDiagram-v2
  [*] --> EMPTY

  EMPTY --> ACTIVE: table.join\n(ハンド非進行中)
  EMPTY --> SEATED_WAIT_NEXT_HAND: table.join\n(ハンド進行中)

  SEATED_WAIT_NEXT_HAND --> ACTIVE: SeatStateChangedEvent\nreason=NEXT_HAND_ACTIVATE
  SEATED_WAIT_NEXT_HAND --> SIT_OUT: table.sitOut\n(即時)
  SEATED_WAIT_NEXT_HAND --> EMPTY: table.leave\n(即時離席/払い戻し)
  SEATED_WAIT_NEXT_HAND --> DISCONNECTED: 切断検知

  ACTIVE --> SIT_OUT: table.sitOut\n(appliesFrom=IMMEDIATE,\n次ハンドから不参加)
  ACTIVE --> LEAVE_PENDING: table.leave\n(ハンド参加中)
  ACTIVE --> EMPTY: table.leave\n(ハンド非参加中)
  ACTIVE --> EMPTY: ハンド精算後 stack==0\nreason=AUTO_LEAVE_ZERO_STACK
  ACTIVE --> DISCONNECTED: 切断検知

  SIT_OUT --> ACTIVE: table.return + 次ハンド開始\n(reason=RETURN or NEXT_HAND_ACTIVATE)
  SIT_OUT --> EMPTY: table.leave\n(即時離席/払い戻し)
  SIT_OUT --> DISCONNECTED: 切断検知

  LEAVE_PENDING --> EMPTY: ハンド終了直後\nreason=LEAVE
  LEAVE_PENDING --> DISCONNECTED: 切断検知

  DISCONNECTED --> ACTIVE: 再接続\nrestoredSeatStatus=ACTIVE
  DISCONNECTED --> SEATED_WAIT_NEXT_HAND: 再接続\nrestoredSeatStatus=SEATED_WAIT_NEXT_HAND
  DISCONNECTED --> SIT_OUT: 再接続\nrestoredSeatStatus=SIT_OUT
  DISCONNECTED --> LEAVE_PENDING: 再接続\nrestoredSeatStatus=LEAVE_PENDING
  DISCONNECTED --> EMPTY: disconnect_streak>=3\n自動LEAVE
```

補足:

- `SeatStateChangedEvent.appliesFrom` は `IMMEDIATE` / `NEXT_HAND` の2値で、同一遷移でも適用タイミングが異なる場合があります。
- `PlayerDisconnectedEvent` は `seatStatus=DISCONNECTED` を通知し、`PlayerReconnectedEvent` は `restoredSeatStatus` へ復帰します。

---

## 4. ハンド状態遷移 (`hands.status`)

```mermaid
stateDiagram-v2
  [*] --> IN_PROGRESS: DealInitEvent

  IN_PROGRESS --> SHOWDOWN: StreetAdvanceEvent\ntableStatus=SHOWDOWN
  IN_PROGRESS --> HAND_END: StreetAdvanceEvent\nreason=HAND_CLOSED / tableStatus=HAND_END
  IN_PROGRESS --> HAND_END: DealEndEvent\nendReason=UNCONTESTED or AUTO_END

  SHOWDOWN --> HAND_END: DealEndEvent\nendReason=SHOWDOWN

  HAND_END --> [*]
```

---

## 5. ハンド内プレイヤー状態遷移 (`hand_players.state`)

```mermaid
stateDiagram-v2
  [*] --> IN_HAND: DealInitEvent\n(ハンド参加者生成)

  IN_HAND --> FOLDED: FoldEvent
  IN_HAND --> AUTO_FOLDED: タイムアウト時\n(toCall>0 かつ非Bring-inで自動fold)
  IN_HAND --> ALL_IN: BringIn/Complete/Bet/Raise/Call\nisAllIn=true
```

補足:

- `FOLDED`, `AUTO_FOLDED`, `ALL_IN` は同一ハンド内の終端状態です。
- `IN_HAND` は終局まで維持される場合があります（チェック/コール継続など）。

---

## 6. 実装時チェックポイント

- テーブル遷移とハンド遷移の整合:
  - `tables.status=SHOWDOWN` のとき `hands.status=SHOWDOWN` へ遷移済みであること
  - `DealEndEvent` 処理後に双方 `HAND_END` へ揃うこと
- 席遷移とハンド参加可否の整合:
  - `SEATED_WAIT_NEXT_HAND` / `SIT_OUT` / `DISCONNECTED` は新規ハンド不参加であること
  - `LEAVE_PENDING` はハンド終了直後に必ず `EMPTY` へ収束すること
- 切断復帰の整合:
  - `disconnect_streak` は再接続時に0へリセット
  - 3ハンド連続切断時に `EMPTY`（自動LEAVE）へ到達すること
- イベント永続化の参照整合:
  - `hand_events.table_id -> tables.id` と `hand_events(hand_id, table_id) -> hands(id, table_id)` のFK制約により、復元/差分配信の前提となるイベント整合がDB層で担保されること
