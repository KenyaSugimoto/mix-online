# M5-12 ローカル統合プレイ確認ログ（テンプレート）

- Task ID: `M5-12`
- 実施日:
- 実施者:
- ブランチ:

## 1. 事前疎通（preflight）

- 実行コマンド:
```bash
pnpm m5-12:preflight -- --output docs/mvp/plans/M5-12_preflight-log_<YYYYMMDD-HHMM>.md
```
- 結果ログ:

## 2. 手動2ユーザー検証

- 前提:
1. `pnpm --filter server dev`
2. `pnpm --filter web dev`
3. 通常ブラウザ + シークレットで別ユーザーをログイン

- 実施ログ:
1. 両セッションで `/lobby` 表示確認（HTTP `/api/*`）
2. 同一卓 `/tables/{tableId}` へ遷移
3. `U1` / `U2` が `JOIN` 実行
4. 3rd から終局まで最低1ハンド実行
5. 終局後に履歴一覧/詳細で同一 `handId` を確認

## 3. 判定

- [ ] HTTP `/api` 経路が正常
- [ ] WS `/ws` 経路が正常
- [ ] 双方の手番進行が一致
- [ ] 終局後に履歴へ同一 `handId` が反映
- [ ] 問題なし（M5-12 DONE）

## 4. 備考

- 不具合/気づき:
- 次アクション:
