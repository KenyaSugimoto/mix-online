---
name: pr-summary-gemini
description: PR作成時のsummary/本文ドラフトをGemini CLIで生成するスキル。CodexにPR作成（`gh pr create`）や変更要約を依頼されたとき、summary生成をCodex自身ではなくGemini CLIへ委譲したい場合に使う。
---

# PR Summary Gemini

## Overview

PR本文の要約生成をGemini CLIへ委譲し、Codexは以下に専念する。

- 変更コンテキストの収集（差分、コミット、テスト結果）
- Gemini CLIの実行
- 生成結果の妥当性確認
- `gh pr create` への反映

## Workflow

1. 前提を確認する。
- `gemini` と `git` と `gh` が利用可能であることを確認する。
- 作業ブランチ上で差分が存在することを確認する。

2. 品質ゲート結果を用意する。
- このリポジトリでは `pnpm lint` / `pnpm typecheck` / `pnpm test` の結果をPR本文に含める。
- 必要なら結果をテキストに保存し、後述の `--test-results-file` に渡す。

3. Gemini CLIでsummaryを生成する。
- 実行コマンド:

```bash
.codex/skills/pr-summary-gemini/scripts/generate-pr-summary.sh \
  --base origin/main \
  --head HEAD \
  --issue-id "<Issue番号またはTask ID>" \
  --doc-links "docs/mvp/要件定義書_mvp.md,docs/mvp/詳細設計書_mvp.md" \
  --test-results-file /tmp/quality-gate.txt \
  --output /tmp/pr-summary.md
```

4. 生成結果をレビューする。
- 事実（差分・実行結果）にない内容が混入していないか確認する。
- 必須セクション（変更概要、テスト結果、影響範囲、未対応項目）があるか確認する。

5. PR作成に使う。

```bash
gh pr create \
  --title "#<Issue> <type>: <summary>" \
  --body-file /tmp/pr-summary.md
```

## Guardrails

- Geminiの出力をそのまま採用せず、必ず最終確認する。
- 未実行テストを「成功」と書かない。
- 仕様変更がある場合は関連ドキュメントリンクを含める。
- summary生成に失敗した場合は、失敗理由をユーザーへ共有し、再試行方針（モデル変更/追加指示）を提示する。

## Resources

- スクリプト: `scripts/generate-pr-summary.sh`
- 出力フォーマット定義: `references/pr-summary-format.md`
