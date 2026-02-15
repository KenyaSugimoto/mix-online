# M5-19 実装計画: テーブル画面をゲームUIへ再設計

- 作成日: 2026-02-14
- 対象タスクID: `M5-19`
- 関連タスク: `M5-18`, `M5-22`, `M5-13`
- 実行戦略: 2段階PR（契約/基盤 -> UI）

---

## 1. 目的

現状の「データ表示中心の卓画面」を、以下を満たす「プレイ可能なゲームUI」に置き換える。

- 座席/カード/手番/ポットを直感的に追える
- 許可アクションのみ操作できる
- 再接続・再同期後も表示整合が保たれる
- 伏せ札情報の秘匿を守る（自分の伏せ札のみ表示）

---

## 2. 固定済み意思決定

- デザイン方向: クラシックカジノ
- 画面範囲: `Table` 画面 + `App` ヘッダー（卓表示時）
- レスポンシブ方針: デスクトップ主軸 + モバイル対応
- 伏せ札表示: 他者は裏面表示（実カード非公開）
- 自分の伏せ札: サーバー配信を viewer 別に個別化して表示
- 再同期方針: `table.snapshot` 契約拡張でカード情報を復元可能にする
- `reason` / `appliesFrom`: UI表示に含める（M5-13要素を同時実施）

---

## 3. スコープ / 非スコープ

### スコープ

1. `table.event` / `table.snapshot` のカード投影仕様拡張
2. サーバーの viewer 別カードマスキング配信
3. Web `TableStore` のカード状態投影と再同期復元
4. 卓レイアウトUI（席配置・カード表示・操作ドック・アクション履歴）
5. `reason` / `appliesFrom` を可視化する状態ログUI

### 非スコープ

1. Lobby / History の全面再設計
2. ゲームルール（PokerActionLogic）の変更
3. 認証/表示名変更機能（`M5-14` / `M5-15`）

---

## 4. 公開契約・型変更（決定事項）

### 4.1 shared型

対象: `packages/shared/src/index.ts`

- `DealCards3rdEventPayload` の `visibility` に `DOWN_SELF` を許容
- `table.snapshot` 側にカード表示復元用スキーマを追加
- viewer向けカード可視性の型を明示化

### 4.2 AsyncAPI

対象: `docs/mvp/asyncapi.yaml`

- `DealCards3rdEventPayload` / `DealCardEventPayload` の visibility 要件更新
- `TableSnapshotMessagePayload` にカード可視化情報を追加
- viewer別マスキング要件（自分のみ伏せ札可視）を記述

---

## 5. 実装フェーズ

## PR1: 契約/Store基盤（M5-18 + M5-22下地）

### サーバー

対象:

- `apps/server/src/realtime/table-service/hand.ts`
- `apps/server/src/realtime/table-service/helpers.ts`
- `apps/server/src/realtime/table-service.ts`
- `apps/server/src/realtime/ws-gateway.ts`

実施:

1. サーバー内部のカード正史は維持（非公開情報を内部保持）
2. 配信直前で viewer 別マスクを適用
3. `resume` の events / snapshot 両方に同じマスクルールを適用
4. `table.snapshot` でカード状態を復元可能にする

### Web Store

対象:

- `apps/web/src/table-store.ts`
- `apps/web/src/table-store.test.ts`

実施:

1. `DealCards3rdEvent`, `DealCardEvent`, `StreetAdvanceEvent`, `ShowdownEvent`, `DealEndEvent` をカード視点で投影
2. snapshot復元時のカード再構成に対応
3. `reason` / `appliesFrom` をUI表示用ログとして保持

## PR2: UI再設計（M5-19本体 + M5-13 UI）

対象:

- `apps/web/src/table-screen.tsx`
- `apps/web/src/app.css`
- `apps/web/src/App.tsx`

実施:

1. 卓メタ情報（卓名、ステークス、接続状態、あなたの残高/スタック）を上部に整理
2. 中央をフェルト卓レイアウト化（6席、ディーラーボタン、ポット、ストリート）
3. 席ごとにカード列・状態・stackを表示（他者伏せ札は裏面）
4. 手番者強調 + タイマー強調
5. 許可アクションのみをフッター操作ドックに表示
6. アクション履歴欄に `reason` / `appliesFrom` を表示
7. 375px / 768px / 1024px+ で破綻しないレスポンシブ調整

---

## 6. テスト計画

### 6.1 サーバー統合

対象: `apps/server/src/__tests__/integration/ws-contract.integration.test.ts`

- viewer別カード可視性差分を検証
- `table.snapshot` 契約の新規キーを検証

### 6.2 Web Store

対象: `apps/web/src/table-store.test.ts`

- Deal/StreetAdvance/Showdown/DealEnd のカード投影
- resume/snapshot 復元後の整合
- reason/appliesFrom ログ保持

### 6.3 Web UI

対象: `apps/web/src/table-screen.tsx` 周辺テスト

- 席強調・手番状態・アクション可否
- 伏せ札表示ルール（自分だけ見える）
- 再接続後の表示復元

---

## 7. 受け入れ条件

1. 卓画面が座席中心のゲームUIとして成立している
2. 自分の伏せ札のみ可視で、他者伏せ札は秘匿される
3. 再接続後にカード表示が仕様どおり復元される
4. 手番中のみ有効なアクション導線が維持される
5. `reason` / `appliesFrom` が画面上で追跡できる
6. PC主軸かつモバイルでも操作可能
7. 品質ゲート4種が全て成功する

---

## 8. 完了時に必ず実行する品質ゲート

```bash
pnpm lint
pnpm check:contract-literals
pnpm typecheck
pnpm test
```

---

## 9. 更新対象ドキュメント（実装時）

1. `docs/mvp/画面設計書_mvp.md`
2. `docs/mvp/詳細設計書_mvp.md`
3. `docs/mvp/asyncapi.yaml`
4. `docs/mvp/進捗管理シート_mvp.md`
5. `docs/mvp/実装推進ガイド_mvp.md`

---

## 10. この計画の運用方法

- 次セッションでこのファイルを読み込めば、追加判断なしで実装開始できる状態にしてある。
- 実装中に判断変更が出た場合は、このファイルの「固定済み意思決定」を先に更新してからコード変更を進める。

