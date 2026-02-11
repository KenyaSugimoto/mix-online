# GitHub運用ルール（mix-online）

このファイルは、`/Users/kenya/dev/github.com/KenyaSugimoto/mix-online` における
AIエージェント実行ルールです。AIエージェントは、実装タスクを開始する前に
本ルールを確認し、必ず適用すること。

## 1. 適用範囲と優先順位

- 対象: コード変更、ドキュメント変更、調査タスク、レビュータスク
- 優先順位:
1. ユーザーの明示指示
2. `AGENTS.md`
3. 本ファイル（`.agent/rules/github-operations.md`）
4. そのほか補助ドキュメント

## 2. 開発フロー（必須）

すべてのタスクを次の順で進める。

### Plan（計画）

- 作業開始前に対象Issueを用意する
- GitHub Issueがない場合:
  - ユーザーにIssue番号を確認する
  - もしくはローカル管理タスク（`docs/mvp/進捗管理シート_mvp.md` のTask ID）をIssue相当IDとして明示する
- 参照ドキュメントを明記する（最低1つ以上）
- 受け入れ条件（3〜7項目）を先に固定する

### Do（実行）

- 実装中の重要判断（設計・仕様解釈・制約）を記録する
- 各作業で更新可能なドキュメントを確認し、該当があれば同一作業内で更新する
- 仕様差分が発生した場合は、同一作業内で `docs/mvp/` を更新する
- スコープ外変更は混ぜない（1PR1目的）

### Check（評価）

- 完了時に最低限以下を実行:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- 受け入れ条件を満たしたかをチェックリストで報告する

### Act（改善）

- 実装で得た知見が再利用可能なら本ルールまたは `docs/mvp/` に反映する
- 仕様の曖昧点は `進捗管理シート` のリスク/意思決定ログに追記候補として残す

## 3. ブランチ戦略（必須）

### 3.1 基本ルール

- `main` へ直接コミットしない
- 作業開始前に **最新mainから作業ブランチを作成** する
- ブランチ名は **`codex/` プレフィックス必須**

### 3.2 命名規則

- 機能追加/改善: `codex/feature/issue-{番号}-{slug}`
- バグ修正: `codex/fix/issue-{番号}-{slug}`
- ドキュメントのみ: `codex/docs/issue-{番号}-{slug}`
- リファクタ: `codex/refactor/issue-{番号}-{slug}`

例:

- `codex/feature/issue-45-lobby-tables-api`
- `codex/fix/issue-67-check-action-validation`

### 3.3 作業開始コマンド例

```bash
git checkout main
git pull origin main
git checkout -b codex/feature/issue-45-lobby-tables-api
```

## 4. Issue運用

### 4.1 作成時に必ず含める項目

- 目的
- 背景
- 実装方針
- 関連ドキュメント
- 完了条件（受け入れ基準）
- Out of Scope（必要な場合）

### 4.2 Issueテンプレート（機能追加/改善）

```md
## 目的
[何を実現したいか]

## 背景
[なぜ必要か]

## 実装方針
[どのように実装するか]

## 関連ドキュメント
- [ ] `docs/mvp/要件定義書_mvp.md`
- [ ] `docs/mvp/詳細設計書_mvp.md`
- [ ] `docs/mvp/openapi.yaml` または `docs/mvp/asyncapi.yaml`
- [ ] `.agent/rules/github-operations.md`

## 完了条件
- [ ] 実装完了
- [ ] テスト追加・更新
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が通過
- [ ] 関連ドキュメント更新（必要時）
- [ ] `docs/mvp/進捗管理シート_mvp.md` 更新

## 備考
[その他]
```

### 4.3 Issueテンプレート（バグ修正）

```md
## 問題の説明
[何が問題か]

## 再現手順
1. ...
2. ...

## 期待される動作
[どうあるべきか]

## 影響範囲
- API:
- Realtime:
- UI:
- DB:

## 関連Issue/関連ドキュメント
- refs #
```

## 5. コミットルール

### 5.1 Explicit Commits Only（必須）

- ユーザーからの明示指示があるまでコミットしない
- AIが自動でコミット・pushしない

### 5.2 Clean Commit（必須）

- コミット前に以下がすべて成功していること:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 5.3 メッセージ形式

基本形式:

```text
<type>: <subject>

<body>

<footer>
```

Type:

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `test`
- `chore`

Subject規約:

- 50文字以内
- 現在形
- 文末ピリオドなし

Footer例:

- `Closes #123`
- `Refs #123`

## 6. PRルール

- タイトルにIssue番号を含める（例: `#45 feat: lobby tables API`）
- 変更概要、テスト結果、影響範囲、未対応項目を記載する
- 仕様変更時は関連ドキュメントリンクを明記する
- ユーザー影響があるUI変更はスクリーンショット/サンプルを添付する

## 7. AI向け実行チェックリスト（作業前）

- [ ] 対象IssueまたはタスクIDを特定した
- [ ] `docs/mvp/` の参照元を列挙した
- [ ] 最新mainから `codex/*` ブランチを作成した
- [ ] 受け入れ条件を固定した
- [ ] Out of Scopeを明示した

## 8. AI向け完了チェックリスト（作業後）

- [ ] 受け入れ条件をすべて満たした
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` が成功
- [ ] 仕様差分があればドキュメント更新済み
- [ ] 更新対象ドキュメントの確認結果を報告した（更新あり/なしの理由）
- [ ] `docs/mvp/進捗管理シート_mvp.md` を更新済み
- [ ] コミットは明示指示がある場合のみ実施

## 9. ルール更新フロー

- 実装中に再発しやすい判断が出た場合は、本ファイルに追記する
- ルール更新自体もPRに含め、関連Issueを参照する
- 更新時は「何を防ぐためのルールか」を1行で明記する

## 10. AIコミュニケーション言語（既定）

- ユーザー向けの報告、PRタイトル/本文、レビューコメントは日本語で記述する
- ユーザーから明示的に別言語指定があった場合のみ、その指定を優先する
- このルールの目的: 文脈齟齬を減らし、レビュー効率を上げるため
