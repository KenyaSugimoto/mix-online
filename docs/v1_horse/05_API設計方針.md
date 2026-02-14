# Mix Online v1 API設計方針（HTTP / Realtime）

> 作成日: 2026-02-13 ｜ 対象バージョン: v1 ｜ ステータス: Draft

## 1. 目的

MVP 契約との互換を維持しつつ、HORSE 対応に必要な拡張を加算的に定義する。

## 2. 基本方針

- 互換優先: 既存フィールドの意味を変更しない。
- 加算拡張: 新 enum 値・新フィールド追加を基本とする。
- 破壊的変更回避: 既存クライアントがクラッシュしない設計を優先。

## 3. HTTP API 方針

- `GameType` enum に 2値追加:
  - `HOLD_EM`
  - `OMAHA_8`
- `mixIndex` の範囲を `0..4` に拡張。
- `handsSinceRotation` は `0..5` 維持。
- 履歴 API は gameType 依存詳細を `detail` 配下で返す。

## 4. Realtime API 方針

- 既存 envelope（`type`, `tableSeq`, `occurredAt`, `payload`）を維持。
- Flop 系専用イベントを追加:
  - `DealBoardFlopEvent`
  - `DealBoardTurnEvent`
  - `DealBoardRiverEvent`
- Stud 系イベントは既存を継続。

## 5. 互換ポリシー

- 旧クライアントは未知 enum を受けても安全にフォールバックできること。
- `additionalProperties: false` の厳格運用は維持するが、導入時は staged rollout とする。
- 契約変更時は `openapi.v1_horse.yaml` / `asyncapi.v1_horse.yaml` を同時更新する。

### 5.1 ActionType の API 間差異（設計意図）

- **OpenAPI（HTTP）**: ハンド履歴に全アクションを記録するため、サーバー起因アクション（`ANTE`, `SMALL_BLIND`, `BIG_BLIND`, `AUTO_CHECK`, `AUTO_FOLD`, `SHOW`, `MUCK`）を含む完全な enum を持つ。
- **AsyncAPI（Realtime）**: クライアントが送信するコマンドのみを `ActionType` に含め、サーバー起因アクションは専用の `EventType`（`PostAnteEvent`, `PostSmallBlindEvent`, `PostBigBlindEvent` 等）で表現する。
- この差異は意図的であり、Web Socket の command / event の責務分離を明確にするための設計判断である。

## 6. エラーハンドリング方針

- 既存 `ErrorCode` を再利用し、必要最小限のみ追加。
- ゲーム固有の不正操作は `INVALID_ACTION` に正規化。
- 可観測性向上のため `requestId` / `tableId` / `handId` をログキーに統一。

## 7. 変更管理

- 仕様変更は本ファイルに決定理由を追記。
- 実体定義は以下を正本とする:
  - `openapi.v1_horse.yaml`
  - `asyncapi.v1_horse.yaml`
