# Mix Stud Online 進捗管理シート（MVP）

Version: v1.0  
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
| M0 | 品質ゲート固定（lint/typecheck/test） | NOT_STARTED | 0% | TBA | TBA | Phase 0 |
| M1 | DB/マイグレーション運用確立 | NOT_STARTED | 0% | TBA | TBA | Phase 1 |
| M2 | ロビー/履歴API実装 | NOT_STARTED | 0% | TBA | TBA | Phase 2 |
| M3 | Realtime + Game Engine成立 | NOT_STARTED | 0% | TBA | TBA | Phase 3 |
| M4 | Web統合（ロビー〜プレイ） | NOT_STARTED | 0% | TBA | TBA | Phase 4 |
| M5 | リリース準備完了 | NOT_STARTED | 0% | TBA | TBA | Phase 5 |

---

## 3. 現在の実行ボード

## Now

| ID | Task | Priority | Status | Acceptance Criteria | Link |
| --- | --- | --- | --- | --- | --- |
| M0-01 | `pnpm lint/typecheck/test` を全てグリーン化し、失敗時の修正方針を確立 | P0 | NOT_STARTED | 3コマンド成功、実行手順を共有 | [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md) |

## Next

| ID | Task | Priority | Status | Ready条件 | Link |
| --- | --- | --- | --- | --- | --- |
| M1-01 | Supabaseマイグレーション雛形作成（DDLとの差分洗い出し含む） | P0 | NOT_STARTED | DDL参照箇所が確定している | [`詳細設計書_mvp.md`](./詳細設計書_mvp.md) |
| M2-01 | `/api/lobby/tables` を OpenAPI準拠で本実装化（仮実装除去） | P0 | NOT_STARTED | OpenAPI該当schemaが確定している | [`openapi.yaml`](./openapi.yaml) |

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
| 2026-W07 | 初版ドキュメント整備 | なし | 初期優先順位未確定 | M0着手 |
