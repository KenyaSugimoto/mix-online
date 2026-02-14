# Mix Stud Online 進捗管理シート（MVP）

Version: v1.29  
Last Updated: 2026-02-14  
実装フロー: [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md)  
要件: [`要件定義書_mvp.md`](./要件定義書_mvp.md)  
詳細設計: [`詳細設計書_mvp.md`](./詳細設計書_mvp.md)

---

## 1. 運用ルール

- 更新タイミング:
  - タスク着手時
  - PR作成時
  - マージ完了時
- ステータス定義:
  - `NOT_STARTED`: 未着手
  - `IN_PROGRESS`: 実装中
  - `BLOCKED`: 外部要因で停止
  - `DONE`: DoD達成済み
- 優先度定義:
  - `P0`: MVP成立に必須
  - `P1`: MVP品質向上に必須
  - `P2`: リリース後でも許容

---

## 2. マイルストーン進捗

| Milestone | 内容 | Status | Progress | Owner | Target Date | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| M0 | 品質ゲート固定（lint/check:contract-literals/typecheck/test） | DONE | 100% | Codex | 2026-02-11 | M0-01〜M0-04完了 |
| M1 | DB/マイグレーション運用確立 | DONE | 100% | Codex | 2026-02-11 | M1-01〜M1-04完了 |
| M2 | ロビー/履歴API実装 | DONE | 100% | Codex | 2026-02-11 | M2-01〜M2-06完了 |
| M3 | Realtime + Game Engine成立 | DONE | 100% | Codex | 2026-02-13 | M3-01〜M3-11完了 |
| M4 | Web統合（ロビー〜プレイ） | DONE | 100% | Codex | 2026-02-14 | M4-01〜M4-06完了 |
| M5 | リリース準備完了 | IN_PROGRESS | 25% | Codex | TBA | M5-10完了、M5-11待ち |

---

## 3. 現在の実行ボード

## Now

| ID | Task | Priority | Status | Acceptance Criteria | Link |
| --- | --- | --- | --- | --- | --- |
| M5-00 | M4完了時点のリリース監査（できること/未対応の棚卸し） | P0 | DONE | 監査結果を進捗管理シートと実装推進ガイドへ反映済み | [`進捗管理シート_mvp.md`](./進捗管理シート_mvp.md), [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| M5-10 | 認証の実ユーザー連携（Google code exchange + user永続化） | P0 | DONE | `/api/auth/me` が固定ユーザー以外を返せる | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M5-11 | Lobby/Table/History のMVP固定データ撤廃（DB Repositoryへ切替） | P0 | NOT_STARTED | APIが実データを返し、fixture前提が不要 | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/repository`](../../apps/server/src/repository), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M5-12 | ローカル統合プレイ確認（HTTP+WS接続経路固定、手動2ユーザー検証） | P0 | NOT_STARTED | ローカルで2人1ハンド完了を再現可能 | [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts), [`apps/web/src/table-store.ts`](../../apps/web/src/table-store.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M5-01 | 構造化ログ/メトリクス/アラート導入（Cloud Logging/Monitoring） | P1 | NOT_STARTED | M5-12 完了 | [`全体アーキテクチャ図_mvp.md`](./全体アーキテクチャ図_mvp.md), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |

## Next

| ID | Task | Priority | Status | Ready条件 | Link |
| --- | --- | --- | --- | --- | --- |
| M5-13 | テーブルUIギャップ解消（`reason`/`appliesFrom` 表示、状態不整合検知ログ） | P1 | NOT_STARTED | M5-12 完了 | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`apps/web/src/table-screen.tsx`](../../apps/web/src/table-screen.tsx) |
| M5-14 | 表示名変更API追加（`PATCH /api/auth/me/display-name`） | P1 | NOT_STARTED | M5-10 完了 | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M5-15 | 表示名変更UI追加（プロフィール編集導線） | P1 | NOT_STARTED | M5-14 完了 | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx) |
| M5-02 | 運用Runbook整備（デプロイ手順、ローリング更新、障害復旧） | P1 | NOT_STARTED | M5-01 完了 | [`全体アーキテクチャ図_mvp.md`](./全体アーキテクチャ図_mvp.md) |

## Backlog

| ID | Task | Priority | Status | 受け入れ観点（要約） | Link |
| --- | --- | --- | --- | --- | --- |
| M4-01 | Web認証導線（ログイン開始、callback後初期化、未認証ガード） | P0 | DONE | HP-01 のUI導線成立 | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`openapi.yaml`](./openapi.yaml) |
| M4-02 | ロビー画面実装（卓一覧表示、参加導線、空席/ゲーム種表示） | P0 | DONE | ロビー仕様表示項目を完全充足 | [`要件定義書_mvp.md`](./要件定義書_mvp.md), [`画面設計書_mvp.md`](./画面設計書_mvp.md) |
| M4-03 | テーブル画面実装（席状態別UI、手番タイマー、アクション入力） | P0 | DONE | 状態別UI制御と操作可否が仕様一致 | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`状態遷移図_mvp.md`](./状態遷移図_mvp.md) |
| M4-04 | クライアント `TableStore` 実装（`tableSeq` 欠番検知、resume再同期） | P0 | DONE | 欠番検知→resume→再収束の動作確認 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`asyncapi.yaml`](./asyncapi.yaml) |
| M4-05 | 履歴画面実装（一覧/詳細、ページング、損益表示） | P1 | DONE | HP-08 のUI要件を満たす | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`openapi.yaml`](./openapi.yaml) |
| M4-06 | E2E導入（HP -> NG -> ED の順でCI組み込み） | P0 | DONE | 主要シナリオを段階導入し回帰検知可能 | [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| M5-01 | 構造化ログ/メトリクス/アラート導入（Cloud Logging/Monitoring） | P1 | NOT_STARTED | 監視最小セットと閾値を運用可能化 | [`全体アーキテクチャ図_mvp.md`](./全体アーキテクチャ図_mvp.md), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M5-02 | 運用Runbook整備（デプロイ手順、ローリング更新、障害復旧） | P1 | NOT_STARTED | 第三者が復旧手順を再現できる | [`全体アーキテクチャ図_mvp.md`](./全体アーキテクチャ図_mvp.md) |
| M5-03 | 非機能検証（レイテンシp95、5xx率、再接続品質） | P1 | NOT_STARTED | 非機能目標の測定結果が取得可能 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M5-14 | 表示名変更API追加（`PATCH /api/auth/me/display-name`） | P1 | NOT_STARTED | ユーザーが任意の表示名へ変更できる | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M5-15 | 表示名変更UI追加（プロフィール編集導線） | P1 | NOT_STARTED | 表示名変更を画面から完結できる | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx) |
| DEC-01 | 未決事項の合意（プレイヤー名変更、最低バイイン、オッドチップ詳細） | P1 | NOT_STARTED | 仕様合意をADR化し関連仕様へ反映 | [`要件定義書_mvp.md`](./要件定義書_mvp.md), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |

## Done

| ID | Task | Priority | Status | Completed At | Link |
| --- | --- | --- | --- | --- | --- |
| M0-01 | `pnpm lint/check:contract-literals/typecheck/test` を全てグリーン化し、失敗時の修正方針を確立 | P0 | DONE | 2026-02-11 | [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| M0-02 | `packages/shared` の共通型を契約準拠で再定義（OpenAPI/AsyncAPI/DDL enum整合） | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql) |
| M0-03 | API/WSの入力バリデーション + 共通エラー応答基盤（`requestId`/`error.code`）を実装 | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml) |
| M0-04 | テスト基盤整備（unit/integration/e2e、固定デッキハーネス、テストデータ初期化） | P0 | DONE | 2026-02-11 | [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M1-01 | Supabaseマイグレーション雛形作成（`supabase/migrations` 正本化） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql) |
| M1-02 | seed投入/ローカル起動/DBリセット手順を確立（`supabase start` 前提） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`README.md`](../../supabase/migrations/README.md), [`20260211190200_seed_initial_data.sql`](../../supabase/migrations/20260211190200_seed_initial_data.sql) |
| M1-03 | Repository層とトランザクション境界を定義（`hand_events` 正史、配信先行禁止） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`apps/server/src/repository/command-repository.ts`](../../apps/server/src/repository/command-repository.ts), [`apps/server/src/repository/persist-command.ts`](../../apps/server/src/repository/persist-command.ts) |
| M1-04 | 主要テーブルCRUDテスト（users/wallets/tables/table_seats/hands/hand_events） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql), [`db-schema.integration.test.ts`](../../apps/server/src/__tests__/integration/db-schema.integration.test.ts) |
| M2-01 | `/api/lobby/tables` を OpenAPI準拠で本実装化（仮実装除去） | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts), [`m0-04-foundation.e2e.test.ts`](../../apps/server/src/__tests__/e2e/m0-04-foundation.e2e.test.ts) |
| M2-02 | `/api/tables/:tableId` を OpenAPI準拠で実装（席状態・進行中ハンド要約含む） | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`table-detail.ts`](../../apps/server/src/table-detail.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| M2-03 | 認証API基盤（Google callback後のCookie session、`/api/auth/me`、`/api/auth/logout`）を実装 | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`auth-session.ts`](../../apps/server/src/auth-session.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| M2-04 | `/api/history/hands` 実装（cursor署名、`endedAt DESC, handId DESC`） | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`history-cursor.ts`](../../apps/server/src/history-cursor.ts), [`history-repository.ts`](../../apps/server/src/repository/history-repository.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| M2-05 | `/api/history/hands/:handId` 実装（streetActions/showdown/profitLoss） | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`history-hand.ts`](../../apps/server/src/history-hand.ts), [`history-repository.ts`](../../apps/server/src/repository/history-repository.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| M2-06 | HTTP契約テスト（OpenAPI準拠チェック、自動化） | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`http-contract.integration.test.ts`](../../apps/server/src/__tests__/integration/http-contract.integration.test.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-01 | WebSocketゲートウェイ実装（`/ws`、コマンド検証、`table.error`） | P0 | DONE | 2026-02-11 | [`asyncapi.yaml`](./asyncapi.yaml), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`server.ts`](../../apps/server/src/realtime/server.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts) |
| M3-02 | Table Actor基盤（卓単位直列処理、`tableSeq/handSeq` 採番） | P0 | DONE | 2026-02-11 | [`table-actor.ts`](../../apps/server/src/realtime/table-actor.ts), [`table-actor.unit.test.ts`](../../apps/server/src/__tests__/unit/table-actor.unit.test.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M3-03 | 席管理コマンド（join/sitOut/return/leave）と状態遷移実装 | P0 | DONE | 2026-02-11 | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts) |
| M3-04 | ハンド開始〜3rd配札基盤（DealInit/PostAnte/DealCards3rd/BringIn） | P0 | DONE | 2026-02-11 | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`fixed-deck-harness.ts`](../../apps/server/src/testing/fixed-deck-harness.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-05 | アクション合法性実装（手番、toCall、5bet cap全卓適用） | P0 | DONE | 2026-02-12 | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-06 | `GameRule` 実装（StudHi/Razz/Stud8 Bring-in/先手判定） | P0 | DONE | 2026-02-11 | [`game-rule.ts`](../../apps/server/src/realtime/game-rule.ts), [`game-rule.unit.test.ts`](../../apps/server/src/__tests__/unit/game-rule.unit.test.ts), [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M3-07 | Showdown評価・Hi/Lo分配・サイドポット・オッドチップ実装 | P0 | DONE | 2026-02-11 | [`showdown-evaluator.ts`](../../apps/server/src/realtime/showdown-evaluator.ts), [`showdown-evaluator.unit.test.ts`](../../apps/server/src/__tests__/unit/showdown-evaluator.unit.test.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-08 | タイムアウト/切断処理（AutoAction、disconnect streak>=3で自動LEAVE） | P0 | DONE | 2026-02-11 | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M3-09 | 再接続復元（`table.resume` 差分再送 + `table.snapshot` フォールバック） | P0 | DONE | 2026-02-11 | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts), [`asyncapi.yaml`](./asyncapi.yaml) |
| M3-10 | サーバー再起動復元（`IN_PROGRESS` リプレイ、タイマー再設定） | P0 | DONE | 2026-02-11 | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`table-actor.ts`](../../apps/server/src/realtime/table-actor.ts), [`server.ts`](../../apps/server/src/realtime/server.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts) |
| M3-11 | Realtime契約テスト（AsyncAPI準拠のイベント/エラー/snapshot） | P0 | DONE | 2026-02-13 | [`ws-contract.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-contract.integration.test.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts), [`asyncapi.yaml`](./asyncapi.yaml) |
| M4-01 | Web認証導線（ログイン開始、callback後初期化、未認証ガード） | P0 | DONE | 2026-02-13 | [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx), [`apps/web/src/auth-api.ts`](../../apps/web/src/auth-api.ts), [`apps/web/src/routes.ts`](../../apps/web/src/routes.ts), [`画面設計書_mvp.md`](./画面設計書_mvp.md) |
| M4-02 | ロビー画面実装（卓一覧表示、参加導線、空席/ゲーム種表示） | P0 | DONE | 2026-02-13 | [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx), [`apps/web/src/lobby-api.ts`](../../apps/web/src/lobby-api.ts), [`apps/web/src/lobby-api.test.ts`](../../apps/web/src/lobby-api.test.ts), [`要件定義書_mvp.md`](./要件定義書_mvp.md) |
| M4-03 | テーブル画面実装（席状態別UI、手番タイマー、アクション入力） | P0 | DONE | 2026-02-14 | [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx), [`apps/web/src/table-screen.tsx`](../../apps/web/src/table-screen.tsx), [`apps/web/src/table-api.ts`](../../apps/web/src/table-api.ts), [`apps/web/src/table-control.ts`](../../apps/web/src/table-control.ts), [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`状態遷移図_mvp.md`](./状態遷移図_mvp.md) |
| M4-04 | クライアント `TableStore` 実装（`tableSeq` 欠番検知、resume再同期） | P0 | DONE | 2026-02-13 | [`apps/web/src/table-store.ts`](../../apps/web/src/table-store.ts), [`apps/web/src/table-store.test.ts`](../../apps/web/src/table-store.test.ts), [`apps/web/src/table-screen.tsx`](../../apps/web/src/table-screen.tsx), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`asyncapi.yaml`](./asyncapi.yaml) |
| M4-05 | 履歴画面実装（一覧/詳細、ページング、損益表示） | P1 | DONE | 2026-02-14 | [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx), [`apps/web/src/routes.ts`](../../apps/web/src/routes.ts), [`apps/web/src/history-api.ts`](../../apps/web/src/history-api.ts), [`apps/web/src/history-api.test.ts`](../../apps/web/src/history-api.test.ts), [`apps/web/src/history-screen.tsx`](../../apps/web/src/history-screen.tsx), [`apps/web/src/app.css`](../../apps/web/src/app.css), [`openapi.yaml`](./openapi.yaml) |
| M4-06 | E2E導入（HP -> NG -> ED の順でCI組み込み） | P0 | DONE | 2026-02-14 | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`apps/server/src/__tests__/e2e/hp.e2e.test.ts`](../../apps/server/src/__tests__/e2e/hp.e2e.test.ts), [`apps/server/src/__tests__/e2e/ng.e2e.test.ts`](../../apps/server/src/__tests__/e2e/ng.e2e.test.ts), [`apps/server/src/__tests__/e2e/ed.e2e.test.ts`](../../apps/server/src/__tests__/e2e/ed.e2e.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M5-10 | 認証の実ユーザー連携（Google code exchange + user永続化） | P0 | DONE | 2026-02-14 | [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`apps/server/src/google-oauth-client.ts`](../../apps/server/src/google-oauth-client.ts), [`apps/server/src/repository/auth-user-repository.ts`](../../apps/server/src/repository/auth-user-repository.ts), [`apps/server/src/__tests__/integration/http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |

## Blocked

| ID | Task | Priority | Blocking Reason | Next Action | Owner |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

## M4完了時点の機能棚卸し（2026-02-14）

| 領域 | できること（確認済み） | まだできないこと / 制約 | リリース判定 |
| --- | --- | --- | --- |
| 認証 | `/api/auth/google/start` / callback / `/api/auth/me` / `/api/auth/logout` の導線は成立し、callbackでGoogle code exchange後に実ユーザーをセッション化できる。初期表示名は匿名ID（`Player-XXXXXX`）で採番し、再ログインで上書きしない | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 未設定時は in-memory fallback（再起動で消える）。ユーザー自身の表示名変更API/UIは未実装 | P0主要対応完了 |
| Lobby/Table/History API | OpenAPI準拠のエンドポイントとWeb画面連携は成立 | `createMvp*Repository` に依存し、実データ経路の確認ができない | P0対応が必要 |
| Realtimeプレイ | Game Engine + WS契約テスト（HP/NG/ED）と `TableStore` の再同期（resume/snapshot）は成立 | ローカルWeb起動時の `/ws` 経路が未固定で、手動2ユーザーの実プレイ確認をまだ記録していない | P0対応が必要 |
| ゲーム画面UI | 席状態に応じた操作可否、手番タイマー、履歴表示が実装済み | `SeatStateChangedEvent.reason` / `appliesFrom` のUIログ保持など、画面設計書の一部要件が未反映 | P1対応が必要 |
| 運用/リリース準備 | 品質ゲート（lint/contract-literals/typecheck/test）とCIの段階E2Eは稼働 | 監視・Runbook・非機能検証が未着手 | P1対応が必要 |

---

## 4. リスクログ

| Date | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| 2026-02-14 | OAuth callbackが固定ユーザーを発行しており、実ユーザー識別ができない | 高 | `M5-10` で code exchange + user永続化 + セッション統合テストを実施 | CLOSED |
| 2026-02-14 | 表示名変更API/UIが未実装のため、匿名IDのまま変更できない | 中 | `M5-14`（API）→ `M5-15`（UI）の順で対応する | OPEN |
| 2026-02-14 | Lobby/Table/History がMVP固定データ依存で本番データ経路を検証できない | 高 | `M5-11` でPostgreSQL Repositoryへ切替し、MVP fixtureはテスト用途へ限定 | OPEN |
| 2026-02-14 | Webクライアントの `/ws` 接続経路がローカル起動構成と不整合になる可能性 | 中 | `M5-12` でWS接続経路を固定し、2ユーザー手動試験を最小受け入れ条件に追加 | OPEN |
| 2026-02-14 | 画面設計書のUIログ要件（`reason`/`appliesFrom`保持）が未充足 | 中 | `M5-13` でUI反映 + 画面仕様テストケースを追加 | OPEN |
| 2026-02-11 | テーブル進行ロジックの複雑化で回帰が起きやすい | 高 | GameRule単体テストを先行整備 | OPEN |

---

## 5. 意思決定ログ（簡易ADR）

| Date | Topic | Decision | Reason | Related Docs |
| --- | --- | --- | --- | --- |
| 2026-02-14 | Colima向けSupabase起動手順の更新（LOCAL-DB-START-01） | `pnpm db:start` は Colima 失敗時に `edge-runtime/logflare/vector` 除外構成を先に試し、最終的にDB-onlyへフォールバックする。認証/REST確認用に `pnpm db:start:api` を追加 | OAuth連携やSupabase REST検証に必要な `SERVICE_ROLE_KEY` をローカルで取得しやすくし、DB-only前提との使い分けを明確化するため | [`scripts/db-start.sh`](../../scripts/db-start.sh), [`scripts/db-start-api.sh`](../../scripts/db-start-api.sh), [`package.json`](../../package.json), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`README.md`](../../supabase/migrations/README.md) |
| 2026-02-14 | 認証表示名の初期値・更新方針（M5-10追補） | 初回ログイン時の `display_name` は Google `name` を使わず匿名ID（`Player-XXXXXX`）を採番し、同一 `google_sub` 再ログイン時は上書きしない。表示名変更機能は `M5-14`（API）と `M5-15`（UI）に分離 | 本名表示を避けるプライバシー要件を満たしつつ、表示名変更機能を段階的に導入するため | [`apps/server/src/repository/auth-user-repository.ts`](../../apps/server/src/repository/auth-user-repository.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`進捗管理シート_mvp.md`](./進捗管理シート_mvp.md) |
| 2026-02-14 | M5-10 認証実運用化方針 | callbackで固定ユーザー発行を廃止し、Google code exchange結果（`sub`/`name`）を `users`/`wallets` へ永続化したユーザーをセッション化する。Supabase未設定時はin-memory fallbackを使用 | リリース阻害P0だった「固定ユーザー依存」を解消し、`/api/auth/me` を実ユーザー基準へ移行するため | [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`apps/server/src/google-oauth-client.ts`](../../apps/server/src/google-oauth-client.ts), [`apps/server/src/repository/auth-user-repository.ts`](../../apps/server/src/repository/auth-user-repository.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| 2026-02-14 | M5着手順（リリース阻害P0の先行解消） | M5は `M5-10(認証実運用化) -> M5-11(実データ化) -> M5-12(ローカル統合プレイ確認)` をP0優先で実施し、完了後に `M5-13/M5-01/M5-02/M5-03` へ進む | 「ローカルで実際にプレイ可能か」と「本番運用前提のデータ経路成立」を先に確定しないと、UI/運用整備の評価が不安定になるため | [`進捗管理シート_mvp.md`](./進捗管理シート_mvp.md), [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts), [`apps/web/src/table-store.ts`](../../apps/web/src/table-store.ts) |
| 2026-02-14 | M4-06 E2E段階導入のCI組み込み方針 | E2Eを `foundation -> HP -> NG -> ED` の順にテストファイル分割し、CIジョブを段階実行へ更新する方針を採用 | 回帰検知を維持しながら、失敗時にカテゴリ単位で原因を切り分けやすくするため | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`apps/server/src/__tests__/e2e/hp.e2e.test.ts`](../../apps/server/src/__tests__/e2e/hp.e2e.test.ts), [`apps/server/src/__tests__/e2e/ng.e2e.test.ts`](../../apps/server/src/__tests__/e2e/ng.e2e.test.ts), [`apps/server/src/__tests__/e2e/ed.e2e.test.ts`](../../apps/server/src/__tests__/e2e/ed.e2e.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| 2026-02-13 | M4-04 TableStore同期方式 | `TableStore` を導入し、`tableSeq` 連番管理・欠番検知時の `table.resume(lastTableSeq)`・`table.snapshot` 反映による再収束をクライアント側で実装する方針を採用 | Cloud Run接続断・一時的な受信欠落があっても、AsyncAPI契約に沿って最終整合へ収束させるため | [`apps/web/src/table-store.ts`](../../apps/web/src/table-store.ts), [`apps/web/src/table-store.test.ts`](../../apps/web/src/table-store.test.ts), [`apps/web/src/table-screen.tsx`](../../apps/web/src/table-screen.tsx), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`asyncapi.yaml`](./asyncapi.yaml) |
| 2026-02-14 | M4-03 テーブル画面の状態別UI制御方針 | `/api/tables/:tableId` の取得結果をもとに、自席 `SeatStatus` ごとに `table.act` 入力可否と `JOIN/SIT_OUT/RETURN/LEAVE` の操作可否を切り替えるUIを実装し、手番タイマー（`actionDeadlineAt`）を表示する方針を採用 | 画面設計書で定義された表示制御（`SEATED_WAIT_NEXT_HAND` / `ACTIVE` / `SIT_OUT` / `LEAVE_PENDING` / `DISCONNECTED`）を、M4-04 の WebSocket 同期実装前にフロント単体で担保するため | [`apps/web/src/table-screen.tsx`](../../apps/web/src/table-screen.tsx), [`apps/web/src/table-api.ts`](../../apps/web/src/table-api.ts), [`apps/web/src/table-control.ts`](../../apps/web/src/table-control.ts), [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`状態遷移図_mvp.md`](./状態遷移図_mvp.md) |
| 2026-02-14 | M4-05 履歴画面の一覧/詳細統合方針 | `GET /api/history/hands` と `GET /api/history/hands/:handId` を同一画面で統合し、一覧選択で詳細を切替、`nextCursor` で追記ページングするUI方針を採用 | HP-08 の「一覧/詳細/損益表示」を1画面で満たしつつ、履歴詳細の再読込やページ追加を局所的に再試行できる構成にするため | [`apps/web/src/history-api.ts`](../../apps/web/src/history-api.ts), [`apps/web/src/history-screen.tsx`](../../apps/web/src/history-screen.tsx), [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx), [`openapi.yaml`](./openapi.yaml) |
| 2026-02-14 | ローカル環境変数の自動読込（LOCAL-AUTH-03） | `apps/server` 起動時に `.env.local` → `.env` を自動読込し、既存環境変数の上書きを禁止する実装に変更 | OAuth設定の `export` 手作業を省きつつ、CIや本番の明示設定値を意図せず書き換えないため | [`env-loader.ts`](../../apps/server/src/env-loader.ts), [`index.ts`](../../apps/server/src/index.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| 2026-02-14 | OAuth callback遷移先の環境差分吸収（LOCAL-AUTH-02） | callback後リダイレクト先を `WEB_CLIENT_ORIGIN` で構成可能にし、ローカル既定を `http://localhost:5173/lobby` に統一した | APIサーバー相対パス `/lobby` へ遷移して `NOT_FOUND` になる誤配線を防ぐため | [`app.ts`](../../apps/server/src/app.ts), [`server.ts`](../../apps/server/src/realtime/server.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| 2026-02-13 | Google OAuth `invalid_client` 再発防止（LOCAL-AUTH-01） | `GOOGLE_OAUTH_CLIENT_ID` を必須設定にし、未設定時は `GET /api/auth/google/start` で即時エラーを返す運用に変更 | Google Console未設定のままOAuth開始して `401 invalid_client` になる曖昧な失敗を、設定漏れとして早期に検知するため | [`app.ts`](../../apps/server/src/app.ts), [`server.ts`](../../apps/server/src/realtime/server.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| 2026-02-11 | 実装推進方式 | AIエージェント委譲 + DoD厳格運用 | 速度より品質を優先するため | [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| 2026-02-11 | 品質ゲート運用（M0-01） | `pnpm lint` → `pnpm check:contract-literals` → `pnpm typecheck` → `pnpm test` の固定順と一次切り分け手順を採用 | 失敗時の調査順序を固定し、復旧時間のばらつきを減らすため | [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| 2026-02-11 | 共通型契約同期（M0-02） | `packages/shared` で契約由来enumを定数化し、契約整合テストを導入 | OpenAPI/AsyncAPI/DDLとの差分を早期検知し、下流実装の型逸脱を防ぐため | [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql) |
| 2026-02-11 | テスト基盤整備（M0-04） | server テストを unit/integration/e2e 層へ分割し、固定デッキ・テストデータ初期化・シナリオID固定を導入 | シナリオ実装前に土台を固定して、後続タスクの追加コストと回帰リスクを下げるため | [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| 2026-02-11 | 入力検証/共通エラー基盤完了（M0-03） | HTTP requestId付与・共通error.code応答・WSコマンド基本検証・requestId重複検知基盤を確定 | M1以降でAPI/WS実装を進める際のエラー仕様ドリフトを防ぐため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml) |
| 2026-02-11 | DBローカル運用手順の固定（M1-02） | `supabase start` 前提で `pnpm db:start/db:reset/db:status/db:stop` を標準手順として採用し、seed適用確認SQLと期待値を文書化 | 開発者ごとの差異を減らし、マイグレーション再現性と初期データ検証のばらつきを防ぐため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`README.md`](../../supabase/migrations/README.md) |
| 2026-02-11 | Colima向け`db:start`フォールバック導入 | `pnpm db:start` で通常起動失敗時に DB 最小構成へ自動フォールバックする運用を採用 | Colima環境でも起動手順を共通化し、M1以降のDB検証を安定化するため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`README.md`](../../supabase/migrations/README.md) |
| 2026-02-11 | Repository境界定義（M1-03） | `apps/server/src/repository` に CommandRepository契約と `persistCommandAndPublish` を導入し、1コマンド=1TX + コミット後配信を実装基準化 | `hand_events` を正史とする整合性前提をコード境界として先行固定し、配信先行による順序破綻を防ぐため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`apps/server/src/repository/command-repository.ts`](../../apps/server/src/repository/command-repository.ts), [`apps/server/src/repository/persist-command.ts`](../../apps/server/src/repository/persist-command.ts) |
| 2026-02-11 | 主要テーブルCRUD検証方針（M1-04） | Docker上のローカルPostgreSQLに対する統合テストで、users/wallets/tables/table_seats/hands/hand_events のCRUDと制約（FK/UNIQUE/CHECK）を実行検証する方針を採用 | DDL記述のみの確認ではなく実行時制約まで担保し、M2以降のRepository/API実装の土台品質を固定するため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql), [`db-schema.integration.test.ts`](../../apps/server/src/__tests__/integration/db-schema.integration.test.ts) |
| 2026-02-11 | PR本文テンプレート改善（LOCAL-PR-TEMPLATE-01） | Before/After、Impact詳細、Risks/Rollback欄を追加したテンプレートに更新 | レビュワーが「何がどう変わるか」を短時間で判断できるようにするため | [`pull_request_template.md`](../../.github/pull_request_template.md) |
| 2026-02-11 | APIリファレンス閲覧改善（LOCAL-DOCS-RENDER-01） | OpenAPIはHTML自動生成、AsyncAPIはPages上の参照導線を提供する運用を採用 | GitHubブラウザで契約仕様を確認しやすくし、手動PDF更新を不要にするため | [`APIリファレンス閲覧ガイド_mvp.md`](./APIリファレンス閲覧ガイド_mvp.md), [`docs-pages.yml`](../../.github/workflows/docs-pages.yml) |
| 2026-02-11 | Pages自動有効化 + AsyncAPI HTML化（LOCAL-DOCS-RENDER-02） | `configure-pages` に `enablement: true` を追加し、AsyncAPIを Web Component でHTML表示する運用へ更新 | Pages未初期化時の404失敗を防ぎ、OpenAPI/AsyncAPIの閲覧導線を同一UXで提供するため | [`docs-pages.yml`](../../.github/workflows/docs-pages.yml), [`build-api-reference-site.sh`](../../scripts/build-api-reference-site.sh), [`APIリファレンス閲覧ガイド_mvp.md`](./APIリファレンス閲覧ガイド_mvp.md) |
| 2026-02-11 | AsyncAPIガバナンスエラー解消（LOCAL-DOCS-RENDER-03） | `asyncapi.yaml` の snapshot 例不足・messageId不足・metadata不足（tags/contact/license）を補完し、validateで error/warning を解消 | AsyncAPIの生成/可視化で失敗しない契約ドキュメント基盤を維持するため | [`asyncapi.yaml`](./asyncapi.yaml), [`APIリファレンス閲覧ガイド_mvp.md`](./APIリファレンス閲覧ガイド_mvp.md) |
| 2026-02-11 | M1完了確認とM2移行判定（M2-01） | M1-01〜M1-04の完了状態を再確認し、M2-01を `IN_PROGRESS` へ更新 | M2実装着手前に進捗整合を固定し、優先タスクの着手状態を明確化するため | [`進捗管理シート_mvp.md`](./進捗管理シート_mvp.md) |
| 2026-02-11 | M2-01 API契約固定（ロビー一覧） | `/api/lobby/tables` を OpenAPI `LobbyTablesResponse` 形式（`stakes` オブジェクト + `serverTime`）へ統一し、変換ロジックとAPI/E2Eテストを追加 | 仮レスポンス形式との差分を先に解消し、以降の履歴API/契約テスト実装での仕様ドリフトを防ぐため | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts), [`m0-04-foundation.e2e.test.ts`](../../apps/server/src/__tests__/e2e/m0-04-foundation.e2e.test.ts) |
| 2026-02-11 | M2-02 卓詳細API実装 | `/api/tables/:tableId` を OpenAPI `TableDetailResponse` 準拠で実装し、席状態・進行中ハンド要約を返すRepository/変換ロジックと統合テストを追加 | ロビー一覧から卓詳細への遷移時に契約固定済みデータを返し、M2-03以降の認証・履歴API実装に向けてHTTP土台を前進させるため | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`table-detail.ts`](../../apps/server/src/table-detail.ts), [`table-detail-repository.ts`](../../apps/server/src/repository/table-detail-repository.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| 2026-02-11 | M2-03 認証API基盤実装 | Google callback後にHttpOnly session cookieを発行し、`/api/auth/me`・`/api/auth/logout` でセッション参照/無効化を行う基盤を実装 | M2-04以降の履歴APIで認証済みユーザー軸のレスポンスを返すための共通土台が必要なため | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`auth-session.ts`](../../apps/server/src/auth-session.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| 2026-02-11 | M2-04 履歴一覧API実装 | `GET /api/history/hands` に認証前提のキーセットページング（`endedAt DESC, handId DESC`）と署名付きcursor検証を実装し、改ざん時 `INVALID_CURSOR` を返す | 履歴詳細API（M2-05）と契約テスト（M2-06）に先立ち、履歴一覧の順序保証とページング境界を先に固定するため | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`history-cursor.ts`](../../apps/server/src/history-cursor.ts), [`history-repository.ts`](../../apps/server/src/repository/history-repository.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| 2026-02-11 | M2-05 履歴詳細API実装 | `GET /api/history/hands/:handId` を実装し、streetActions/showdown/profitLoss を返却。履歴一覧との `handId/tableId/profitLoss` 整合を統合テストで固定 | 履歴画面で必要な詳細表示データを確定し、M2-06契約テストで正常/異常系を一括固定する前提を整えるため | [`openapi.yaml`](./openapi.yaml), [`apps/server/src/app.ts`](../../apps/server/src/app.ts), [`history-hand.ts`](../../apps/server/src/history-hand.ts), [`history-repository.ts`](../../apps/server/src/repository/history-repository.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts) |
| 2026-02-11 | M2-06 HTTP契約テスト固定 | OpenAPIで定義したMVP対象HTTP API（Auth/Lobby/Tables/History）の正常系・異常系を統合契約テストとして追加し、継続検証を自動化 | M2完了条件である「契約逸脱をCIで即検知できる状態」を満たすため | [`openapi.yaml`](./openapi.yaml), [`http-contract.integration.test.ts`](../../apps/server/src/__tests__/integration/http-contract.integration.test.ts), [`http-api.integration.test.ts`](../../apps/server/src/__tests__/integration/http-api.integration.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| 2026-02-11 | AsyncAPI表示方式の更新（LOCAL-DOCS-RENDER-04） | AsyncAPI表示を Web Component 直描画から AsyncAPI CLI + html-template による静的HTML生成へ切替 | ブラウザ実行時パーサー依存の表示エラーを回避し、Pages表示の再現性を高めるため | [`build-api-reference-site.sh`](../../scripts/build-api-reference-site.sh), [`APIリファレンス閲覧ガイド_mvp.md`](./APIリファレンス閲覧ガイド_mvp.md) |
| 2026-02-11 | 契約リテラル再発防止ルール導入（LOCAL-CONTRACT-LITERAL-01） | `apps/` 配下で `FIXED_LIMIT` / `STUD_*` の文字列直書きを検出する `pnpm check:contract-literals` を導入し、CI/PRテンプレート/運用ルールへ組み込む | 契約値変更時の追従漏れとテスト期待値のハードコード再発を防ぐため | [`check-contract-literals.sh`](../../scripts/check-contract-literals.sh), [`ci.yml`](../../.github/workflows/ci.yml), [`github-operations.md`](../../.agent/rules/github-operations.md), [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| 2026-02-12 | PR前品質ゲート更新（LOCAL-CONTRACT-LITERAL-02） | PR作成前の必須チェックを `pnpm lint` → `pnpm check:contract-literals` → `pnpm typecheck` → `pnpm test` へ統一 | PR作成時に `check:contract-literals` の実行漏れを防ぎ、契約リテラルの回帰混入を抑止するため | [`AGENTS.md`](../../AGENTS.md), [`github-operations.md`](../../.agent/rules/github-operations.md), [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| 2026-02-11 | M3-01 WebSocketゲートウェイ初期実装 | `ws` サーバーを `/ws` に追加し、セッション必須化・コマンド基本検証・`ping/pong`・`table.error` 応答を先行実装 | M3の後続タスク（Table Actor、席管理、進行制御）を段階実装できる最小Realtime基盤を先に固定するため | [`asyncapi.yaml`](./asyncapi.yaml), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`server.ts`](../../apps/server/src/realtime/server.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts) |
| 2026-02-11 | M3-02 Table Actor直列基盤の先行固定 | 卓ごとの処理キュー (`TableActor`) と `tableSeq/handSeq` 採番器を独立実装し、並行投入時の順序保証を単体テストで固定 | 席管理・ゲーム進行・再接続処理を後続タスクで実装する際に、順序逆転と競合を土台で防止するため | [`table-actor.ts`](../../apps/server/src/realtime/table-actor.ts), [`table-actor.unit.test.ts`](../../apps/server/src/__tests__/unit/table-actor.unit.test.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| 2026-02-11 | M3-03 席管理コマンド実装 | `table.join/sitOut/return/leave` を `RealtimeTableService` 上で実装し、`SeatStateChangedEvent` を `table.event` として配信する構成に更新 | M3-04以降のハンド進行実装に入る前に、席遷移とRealtime配信の整合を固定するため | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts) |
| 2026-02-11 | M3-04 ハンド開始〜3rd配札基盤実装 | 2人目着席時に `DealInit -> PostAnte -> DealCards3rd -> BringIn` を自動発行し、`tableSeq/handSeq` の連番を維持する初期進行基盤を実装 | M3-05以降のアクション合法性・ゲームルール・ショーダウン実装を進めるためのハンド状態土台が必要なため | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| 2026-02-12 | M3-05 アクション合法性実装 | `table.act` の5bet cap判定をヘッズアップ含む全卓へ統一し、手番検証・toCall時CHECK拒否と合わせて固定した | 実卓人数に依存しない単純なベッティング上限制約へ仕様統一し、判定分岐を減らすため | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| 2026-02-11 | M3-06 GameRule抽象の実装 | StudHi/Stud8/Razz で Bring-in/先手判定を切り替える `GameRule` を追加し、テーブル進行側からルール参照する構成へ更新 | ルール依存ロジックを分離して、M3-07以降のショーダウン評価やゲーム種拡張時の差分影響を局所化するため | [`game-rule.ts`](../../apps/server/src/realtime/game-rule.ts), [`game-rule.unit.test.ts`](../../apps/server/src/__tests__/unit/game-rule.unit.test.ts), [`table-service.ts`](../../apps/server/src/realtime/table-service.ts) |
| 2026-02-11 | M3-07 Showdown評価/分配ロジック実装 | Showdown評価器を追加し、Stud8 Hi/Lo分配・サイドポット・オッドチップ（Hi優先/ディーラー起点）を単体テストで固定 | HP-06/HP-07 と ED-04〜ED-08 をコード上で再現し、M3-08以降の進行/復元実装の前に配当ロジックを先に確定するため | [`showdown-evaluator.ts`](../../apps/server/src/realtime/showdown-evaluator.ts), [`showdown-evaluator.unit.test.ts`](../../apps/server/src/__tests__/unit/showdown-evaluator.unit.test.ts), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| 2026-02-11 | M3-08 タイムアウト/切断処理実装 | 手番タイマーを導入し、タイムアウト時の自動 `CHECK/FOLD`（`isAuto=true`）と切断/再接続イベント、`disconnectStreak>=3` の自動LEAVE処理を追加 | NG-10とAutoAction要件をM3-09以降の再接続復元実装前に固定し、切断中進行の整合を先に担保するため | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`table-service.unit.test.ts`](../../apps/server/src/__tests__/unit/table-service.unit.test.ts), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| 2026-02-11 | M3-09 再接続復元（resume/snapshot）実装 | `table.resume` を実装し、差分再送可能時は `table.event` 連番再送、保持外は `table.snapshot(reason=OUT_OF_RANGE)` フォールバックを返す構成へ更新 | HP-09/HP-11 の復元要件をM3-10再起動復元の前に固定し、再接続経路の整合性とsnapshot必須キーの維持を担保するため | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts), [`asyncapi.yaml`](./asyncapi.yaml) |
| 2026-02-11 | M3-10 サーバー再起動復元基盤実装 | Realtime状態の export/restore と actor採番復元を追加し、起動時に pending action table のタイマー再設定を行う構成へ更新 | HP-12で要求される「再起動後も tableSeq を継続して進行できる」性質をM3-11契約テスト前に固定するため | [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`table-actor.ts`](../../apps/server/src/realtime/table-actor.ts), [`server.ts`](../../apps/server/src/realtime/server.ts), [`ws-gateway.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-gateway.integration.test.ts) |
| 2026-02-13 | M3-11 Realtime契約テスト追加 | AsyncAPI記述と実際のWSメッセージ（`table.event/error/snapshot/pong`）の整合を統合テストで検証し、契約逸脱をCIで検出できる状態に更新 | M3完了条件であるRealtime契約逸脱ゼロを担保し、M4以降の画面実装で契約変更の破壊的影響を即時検知するため | [`ws-contract.integration.test.ts`](../../apps/server/src/__tests__/integration/ws-contract.integration.test.ts), [`asyncapi.yaml`](./asyncapi.yaml) |
| 2026-02-13 | 大規模ファイルの責務分割（LOCAL-REFACTOR-SPLIT-01） | `history-repository` / `showdown-evaluator` / `ws-gateway` / `table-service` を責務単位で分割し、型定義・純粋ロジック・オーケストレーションを分離した | 単一ファイル肥大化によるレビュー負荷と変更時の影響範囲把握コストを下げ、今後の機能追加時の安全性を高めるため | [`history-repository.ts`](../../apps/server/src/repository/history-repository.ts), [`showdown-evaluator.ts`](../../apps/server/src/realtime/showdown-evaluator.ts), [`ws-gateway.ts`](../../apps/server/src/realtime/ws-gateway.ts), [`table-service.ts`](../../apps/server/src/realtime/table-service.ts), [`table-service-seat-command.ts`](../../apps/server/src/realtime/table-service-seat-command.ts), [`table-service-act-command.ts`](../../apps/server/src/realtime/table-service-act-command.ts), [`table-service-hand.ts`](../../apps/server/src/realtime/table-service-hand.ts), [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| 2026-02-13 | M4-01 Web認証導線の実装方針 | `/login` と `/lobby` をSPAルートとして追加し、保護ルート初期表示時に `GET /api/auth/me` を実行して未認証ガードをかける方針を採用 | HP-01 の「callback後初期化」と「未認証ガード」をフロントで先行確立し、M4-02以降のロビー/卓画面へ段階拡張しやすくするため | [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx), [`apps/web/src/auth-api.ts`](../../apps/web/src/auth-api.ts), [`openapi.yaml`](./openapi.yaml) |
| 2026-02-13 | M4-02 ロビー一覧と参加導線の実装方針 | `/api/lobby/tables` の取得結果をロビーカードとして表示し、`tableId/tableName/stakes/players/maxPlayers/gameType/emptySeats` を明示して `参加する` から `/tables/:tableId` へ遷移する方針を採用 | 要件定義 11.1 の表示要件をフロントで満たしつつ、M4-03 の卓画面実装へ自然に接続できる導線を先行確立するため | [`apps/web/src/App.tsx`](../../apps/web/src/App.tsx), [`apps/web/src/lobby-api.ts`](../../apps/web/src/lobby-api.ts), [`要件定義書_mvp.md`](./要件定義書_mvp.md) |

---

## 6. AIエージェント依頼テンプレート

```md
### Task
- 例: ロビーAPI `/api/lobby/tables` を詳細設計準拠で本実装化

### 参照ドキュメント
- docs/mvp/要件定義書_mvp.md: 該当節
- docs/mvp/詳細設計書_mvp.md: 該当節
- docs/mvp/openapi.yaml: 該当エンドポイント

### Acceptance Criteria
- [ ] 正常系レスポンスがOpenAPI通り
- [ ] 異常系（認可/入力不正）が定義通り
- [ ] 単体テスト追加
- [ ] `pnpm lint` / `pnpm check:contract-literals` / `pnpm typecheck` / `pnpm test` が通る
- [ ] 進捗管理シート更新

### Out of Scope
- 例: WebSocket実装は含めない
```

---

## 7. 週次レビュー記録

| Week | Done | In Progress | Risks | Next Focus |
| --- | --- | --- | --- | --- |
| 2026-W07 | 初版ドキュメント整備、実装タスク分解（Next/Backlog拡張）、M0-01〜M0-04完了、M1-01〜M1-04完了、M2-01〜M2-06完了、M3-01〜M3-11完了、M4-01〜M4-06完了、M5-00（現況監査）完了、M5-10完了 | なし | MVP固定データ依存、ローカルWS経路未固定、DEC-01 が残存 | M5-11 -> M5-12 の順にP0解消 |
