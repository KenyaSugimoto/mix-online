# M5-12 ローカル統合プレイ確認ログ

- Task ID: `M5-12`
- 実施日: 2026-02-15
- 実施者: Codex
- ブランチ: `codex/feature/issue-m5-12-local-integration-check`

## 1. 事前疎通（preflight）

- 実行コマンド:
```bash
pnpm m5-12:preflight -- --output docs/mvp/plans/M5-12_preflight-log_20260215-2.md
```
- 結果ログ:
  - `docs/mvp/plans/M5-12_preflight-log_20260215-2.md`
  - 判定: OK（HTTP `/api/health` direct/proxy, WS `/ws` direct/proxy）

## 2. 手動2ユーザー検証

- 前提:
1. `pnpm --filter server dev`
2. `pnpm --filter web dev`
3. 通常ブラウザ + シークレットで別ユーザーをログイン

- 実施ログ:
1. ユーザー環境で通常ブラウザ + シークレットの2セッションを用いて同一卓へ参加。
2. 2ユーザーで1ハンド終局まで進行し、双方で手番進行一致を確認。
3. 終局後の履歴一覧/詳細で同一 `handId` の反映を確認。

## 3. 判定

- [x] HTTP `/api` 経路が正常（preflight）
- [x] WS `/ws` 経路が正常（preflight）
- [x] 双方の手番進行が一致
- [x] 終局後に履歴へ同一 `handId` が反映
- [x] 問題なし（M5-12 DONE）

## 4. 備考

- 不具合/気づき:
  - preflight と手動2ユーザー検証の双方で受け入れ条件を満たした。
- 次アクション:
  - `M5-20`（Realtime契約/E2E強化）へ着手する。
