# Mix Stud Online 進捗管理シート（MVP）

Version: v1.10  
Last Updated: 2026-02-11  
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
| M0 | 品質ゲート固定（lint/typecheck/test） | DONE | 100% | Codex | 2026-02-11 | M0-01〜M0-04完了 |
| M1 | DB/マイグレーション運用確立 | DONE | 100% | Codex | 2026-02-11 | M1-01〜M1-04完了 |
| M2 | ロビー/履歴API実装 | NOT_STARTED | 0% | TBA | TBA | Phase 2 |
| M3 | Realtime + Game Engine成立 | NOT_STARTED | 0% | TBA | TBA | Phase 3 |
| M4 | Web統合（ロビー〜プレイ） | NOT_STARTED | 0% | TBA | TBA | Phase 4 |
| M5 | リリース準備完了 | NOT_STARTED | 0% | TBA | TBA | Phase 5 |

---

## 3. 現在の実行ボード

## Now

| ID | Task | Priority | Status | Acceptance Criteria | Link |
| --- | --- | --- | --- | --- | --- |
| M2-01 | `/api/lobby/tables` を OpenAPI準拠で本実装化（仮実装除去） | P0 | NOT_STARTED | OpenAPI該当schemaが確定している | [`openapi.yaml`](./openapi.yaml), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |

## Next

| ID | Task | Priority | Status | Ready条件 | Link |
| --- | --- | --- | --- | --- | --- |
| M2-02 | `/api/tables/:tableId` を OpenAPI準拠で実装（席状態・進行中ハンド要約含む） | P0 | NOT_STARTED | テーブル/席状態モデルが確定している | [`openapi.yaml`](./openapi.yaml), [`状態遷移図_mvp.md`](./状態遷移図_mvp.md) |
| M2-03 | 認証API基盤（Google callback後のCookie session、`/api/auth/me`、`/api/auth/logout`）を実装 | P0 | NOT_STARTED | OAuth redirect/Cookie方針が確定している | [`全体アーキテクチャ図_mvp.md`](./全体アーキテクチャ図_mvp.md), [`openapi.yaml`](./openapi.yaml) |

## Done

| ID | Task | Priority | Status | Completed At | Link |
| --- | --- | --- | --- | --- | --- |
| M0-01 | `pnpm lint/typecheck/test` を全てグリーン化し、失敗時の修正方針を確立 | P0 | DONE | 2026-02-11 | [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| M0-02 | `packages/shared` の共通型を契約準拠で再定義（OpenAPI/AsyncAPI/DDL enum整合） | P0 | DONE | 2026-02-11 | [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql) |
| M0-03 | API/WSの入力バリデーション + 共通エラー応答基盤（`requestId`/`error.code`）を実装 | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml) |
| M0-04 | テスト基盤整備（unit/integration/e2e、固定デッキハーネス、テストデータ初期化） | P0 | DONE | 2026-02-11 | [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M1-01 | Supabaseマイグレーション雛形作成（`supabase/migrations` 正本化） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql) |
| M1-02 | seed投入/ローカル起動/DBリセット手順を確立（`supabase start` 前提） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`README.md`](../../supabase/migrations/README.md), [`20260211190200_seed_initial_data.sql`](../../supabase/migrations/20260211190200_seed_initial_data.sql) |
| M1-03 | Repository層とトランザクション境界を定義（`hand_events` 正史、配信先行禁止） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`apps/server/src/repository/command-repository.ts`](../../apps/server/src/repository/command-repository.ts), [`apps/server/src/repository/persist-command.ts`](../../apps/server/src/repository/persist-command.ts) |
| M1-04 | 主要テーブルCRUDテスト（users/wallets/tables/table_seats/hands/hand_events） | P0 | DONE | 2026-02-11 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql), [`db-schema.integration.test.ts`](../../apps/server/src/__tests__/integration/db-schema.integration.test.ts) |

## Backlog

| ID | Task | Priority | Status | 受け入れ観点（要約） | Link |
| --- | --- | --- | --- | --- | --- |
| M2-04 | `/api/history/hands` 実装（cursor署名、`endedAt DESC, handId DESC`） | P0 | NOT_STARTED | 正常ページング + 改ざんcursorで `INVALID_CURSOR` | [`openapi.yaml`](./openapi.yaml), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M2-05 | `/api/history/hands/:handId` 実装（streetActions/showdown/profitLoss） | P0 | NOT_STARTED | 一覧/詳細の整合、未存在時404 | [`openapi.yaml`](./openapi.yaml) |
| M2-06 | HTTP契約テスト（OpenAPI準拠チェック、自動化） | P0 | NOT_STARTED | MVP対象エンドポイントの正常/異常系を固定 | [`openapi.yaml`](./openapi.yaml), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-01 | WebSocketゲートウェイ実装（`/ws`、コマンド検証、`table.error`） | P0 | NOT_STARTED | AsyncAPIのcommand/error schema準拠 | [`asyncapi.yaml`](./asyncapi.yaml) |
| M3-02 | Table Actor基盤（卓単位直列処理、`tableSeq/handSeq` 採番） | P0 | NOT_STARTED | 順序逆転・競合なしを担保 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`状態遷移図_mvp.md`](./状態遷移図_mvp.md) |
| M3-03 | 席管理コマンド（join/sitOut/return/leave）と状態遷移実装 | P0 | NOT_STARTED | `SEATED_WAIT_NEXT_HAND`/`LEAVE_PENDING` を含む遷移整合 | [`状態遷移図_mvp.md`](./状態遷移図_mvp.md), [`画面設計書_mvp.md`](./画面設計書_mvp.md) |
| M3-04 | ハンド開始〜3rd配札基盤（DealInit/PostAnte/DealCards3rd/BringIn） | P0 | NOT_STARTED | ハンド開始条件・Bring-in確定・pot整合 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-05 | アクション合法性実装（手番、toCall、5bet cap、heads-up例外） | P0 | NOT_STARTED | NG-04〜NG-07, ED-11 を満たす | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-06 | `GameRule` 実装（StudHi/Razz/Stud8 Bring-in/先手判定） | P0 | NOT_STARTED | ED-01/ED-02 を再現可能 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M3-07 | Showdown評価・Hi/Lo分配・サイドポット・オッドチップ実装 | P0 | NOT_STARTED | HP-06/HP-07, ED-04〜ED-08 を満たす | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-08 | タイムアウト/切断処理（AutoAction、disconnect streak>=3で自動LEAVE） | P0 | NOT_STARTED | NG-10、AUTO_CHECK/AUTO_FOLD履歴反映 | [`要件定義書_mvp.md`](./要件定義書_mvp.md), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M3-09 | 再接続復元（`table.resume` 差分再送 + `table.snapshot` フォールバック） | P0 | NOT_STARTED | HP-09/HP-11 と snapshot schema検証を満たす | [`asyncapi.yaml`](./asyncapi.yaml), [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M3-10 | サーバー再起動復元（`IN_PROGRESS` リプレイ、タイマー再設定） | P0 | NOT_STARTED | HP-12 で再起動前後整合を満たす | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M3-11 | Realtime契約テスト（AsyncAPI準拠のイベント/エラー/snapshot） | P0 | NOT_STARTED | `table.event/error/snapshot/pong` の契約逸脱ゼロ | [`asyncapi.yaml`](./asyncapi.yaml) |
| M4-01 | Web認証導線（ログイン開始、callback後初期化、未認証ガード） | P0 | NOT_STARTED | HP-01 のUI導線成立 | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`openapi.yaml`](./openapi.yaml) |
| M4-02 | ロビー画面実装（卓一覧表示、参加導線、空席/ゲーム種表示） | P0 | NOT_STARTED | ロビー仕様表示項目を完全充足 | [`要件定義書_mvp.md`](./要件定義書_mvp.md), [`画面設計書_mvp.md`](./画面設計書_mvp.md) |
| M4-03 | テーブル画面実装（席状態別UI、手番タイマー、アクション入力） | P0 | NOT_STARTED | 状態別UI制御と操作可否が仕様一致 | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`状態遷移図_mvp.md`](./状態遷移図_mvp.md) |
| M4-04 | クライアント `TableStore` 実装（`tableSeq` 欠番検知、resume再同期） | P0 | NOT_STARTED | 欠番検知→resume→再収束の動作確認 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`asyncapi.yaml`](./asyncapi.yaml) |
| M4-05 | 履歴画面実装（一覧/詳細、ページング、損益表示） | P1 | NOT_STARTED | HP-08 のUI要件を満たす | [`画面設計書_mvp.md`](./画面設計書_mvp.md), [`openapi.yaml`](./openapi.yaml) |
| M4-06 | E2E導入（HP -> NG -> ED の順でCI組み込み） | P0 | NOT_STARTED | 主要シナリオを段階導入し回帰検知可能 | [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| M5-01 | 構造化ログ/メトリクス/アラート導入（Cloud Logging/Monitoring） | P1 | NOT_STARTED | 監視最小セットと閾値を運用可能化 | [`全体アーキテクチャ図_mvp.md`](./全体アーキテクチャ図_mvp.md), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M5-02 | 運用Runbook整備（デプロイ手順、ローリング更新、障害復旧） | P1 | NOT_STARTED | 第三者が復旧手順を再現できる | [`全体アーキテクチャ図_mvp.md`](./全体アーキテクチャ図_mvp.md) |
| M5-03 | 非機能検証（レイテンシp95、5xx率、再接続品質） | P1 | NOT_STARTED | 非機能目標の測定結果が取得可能 | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| DEC-01 | 未決事項の合意（プレイヤー名変更、最低バイイン、オッドチップ詳細） | P1 | NOT_STARTED | 仕様合意をADR化し関連仕様へ反映 | [`要件定義書_mvp.md`](./要件定義書_mvp.md), [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |

## Blocked

| ID | Task | Priority | Blocking Reason | Next Action | Owner |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

---

## 4. リスクログ

| Date | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| 2026-02-11 | テーブル進行ロジックの複雑化で回帰が起きやすい | 高 | GameRule単体テストを先行整備 | OPEN |

---

## 5. 意思決定ログ（簡易ADR）

| Date | Topic | Decision | Reason | Related Docs |
| --- | --- | --- | --- | --- |
| 2026-02-11 | 実装推進方式 | AIエージェント委譲 + DoD厳格運用 | 速度より品質を優先するため | [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| 2026-02-11 | 品質ゲート運用（M0-01） | `pnpm lint` → `pnpm typecheck` → `pnpm test` の固定順と一次切り分け手順を採用 | 失敗時の調査順序を固定し、復旧時間のばらつきを減らすため | [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |
| 2026-02-11 | 共通型契約同期（M0-02） | `packages/shared` で契約由来enumを定数化し、契約整合テストを導入 | OpenAPI/AsyncAPI/DDLとの差分を早期検知し、下流実装の型逸脱を防ぐため | [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql) |
| 2026-02-11 | テスト基盤整備（M0-04） | server テストを unit/integration/e2e 層へ分割し、固定デッキ・テストデータ初期化・シナリオID固定を導入 | シナリオ実装前に土台を固定して、後続タスクの追加コストと回帰リスクを下げるため | [`E2Eシナリオ集_mvp.md`](./E2Eシナリオ集_mvp.md) |
| 2026-02-11 | 入力検証/共通エラー基盤完了（M0-03） | HTTP requestId付与・共通error.code応答・WSコマンド基本検証・requestId重複検知基盤を確定 | M1以降でAPI/WS実装を進める際のエラー仕様ドリフトを防ぐため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml) |
| 2026-02-11 | DBローカル運用手順の固定（M1-02） | `supabase start` 前提で `pnpm db:start/db:reset/db:status/db:stop` を標準手順として採用し、seed適用確認SQLと期待値を文書化 | 開発者ごとの差異を減らし、マイグレーション再現性と初期データ検証のばらつきを防ぐため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`README.md`](../../supabase/migrations/README.md) |
| 2026-02-11 | Colima向け`db:start`フォールバック導入 | `pnpm db:start` で通常起動失敗時に DB 最小構成へ自動フォールバックする運用を採用 | Colima環境でも起動手順を共通化し、M1以降のDB検証を安定化するため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`README.md`](../../supabase/migrations/README.md) |
| 2026-02-11 | Repository境界定義（M1-03） | `apps/server/src/repository` に CommandRepository契約と `persistCommandAndPublish` を導入し、1コマンド=1TX + コミット後配信を実装基準化 | `hand_events` を正史とする整合性前提をコード境界として先行固定し、配信先行による順序破綻を防ぐため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`apps/server/src/repository/command-repository.ts`](../../apps/server/src/repository/command-repository.ts), [`apps/server/src/repository/persist-command.ts`](../../apps/server/src/repository/persist-command.ts) |
| 2026-02-11 | 主要テーブルCRUD検証方針（M1-04） | Docker上のローカルPostgreSQLに対する統合テストで、users/wallets/tables/table_seats/hands/hand_events のCRUDと制約（FK/UNIQUE/CHECK）を実行検証する方針を採用 | DDL記述のみの確認ではなく実行時制約まで担保し、M2以降のRepository/API実装の土台品質を固定するため | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md), [`20260211190000_create_tables.sql`](../../supabase/migrations/20260211190000_create_tables.sql), [`db-schema.integration.test.ts`](../../apps/server/src/__tests__/integration/db-schema.integration.test.ts) |
| 2026-02-11 | PR本文テンプレート改善（LOCAL-PR-TEMPLATE-01） | Before/After、Impact詳細、Risks/Rollback欄を追加したテンプレートに更新 | レビュワーが「何がどう変わるか」を短時間で判断できるようにするため | [`pull_request_template.md`](../../.github/pull_request_template.md) |
| 2026-02-11 | APIリファレンス閲覧改善（LOCAL-DOCS-RENDER-01） | OpenAPIはHTML自動生成、AsyncAPIはPages上の参照導線を提供する運用を採用 | GitHubブラウザで契約仕様を確認しやすくし、手動PDF更新を不要にするため | [`APIリファレンス閲覧ガイド_mvp.md`](./APIリファレンス閲覧ガイド_mvp.md), [`docs-pages.yml`](../../.github/workflows/docs-pages.yml) |

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
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通る
- [ ] 進捗管理シート更新

### Out of Scope
- 例: WebSocket実装は含めない
```

---

## 7. 週次レビュー記録

| Week | Done | In Progress | Risks | Next Focus |
| --- | --- | --- | --- | --- |
| 2026-W07 | 初版ドキュメント整備、実装タスク分解（Next/Backlog拡張）、M0-01〜M0-04完了、M1-01〜M1-04完了 | - | 仕様未決事項（DEC-01）が残存 | M2-01 着手 |
