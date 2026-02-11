#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  generate-pr-summary.sh [options]

Options:
  --base <ref>                Base ref for comparison (default: origin/main)
  --head <ref>                Head ref for comparison (default: HEAD)
  --issue-id <id>             Issue番号またはTask ID（任意）
  --doc-links <csv>           関連ドキュメントのカンマ区切り一覧（任意）
  --test-results-file <path>  品質ゲート実行結果のテキストファイル（任意）
  --extra-instructions <path> Geminiへの追加指示ファイル（任意）
  --model <name>              Gemini model名（任意）
  --max-diff-chars <number>   Promptへ含めるdiff最大文字数（default: 120000）
  --output <path>             出力先（default: /tmp/pr-summary-gemini.md）
  -h, --help                  Show this help

Examples:
  .codex/skills/pr-summary-gemini/scripts/generate-pr-summary.sh \
    --issue-id "LOCAL-SKILL-PR-SUMMARY-GEMINI-01" \
    --doc-links "docs/mvp/実装推進ガイド_mvp.md,.agent/rules/github-operations.md" \
    --test-results-file /tmp/quality-gate.txt \
    --output /tmp/pr-summary.md
EOF
}

BASE_REF="origin/main"
HEAD_REF="HEAD"
ISSUE_ID=""
DOC_LINKS=""
TEST_RESULTS_FILE=""
EXTRA_INSTRUCTIONS_FILE=""
MODEL=""
MAX_DIFF_CHARS=120000
OUTPUT_FILE="/tmp/pr-summary-gemini.md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_REF="$2"
      shift 2
      ;;
    --head)
      HEAD_REF="$2"
      shift 2
      ;;
    --issue-id)
      ISSUE_ID="$2"
      shift 2
      ;;
    --doc-links)
      DOC_LINKS="$2"
      shift 2
      ;;
    --test-results-file)
      TEST_RESULTS_FILE="$2"
      shift 2
      ;;
    --extra-instructions)
      EXTRA_INSTRUCTIONS_FILE="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --max-diff-chars)
      MAX_DIFF_CHARS="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  echo "[ERROR] git command not found." >&2
  exit 1
fi

if ! command -v gemini >/dev/null 2>&1; then
  echo "[ERROR] gemini command not found." >&2
  exit 1
fi

git rev-parse --verify "$BASE_REF" >/dev/null
git rev-parse --verify "$HEAD_REF" >/dev/null

if [[ -n "$TEST_RESULTS_FILE" && ! -f "$TEST_RESULTS_FILE" ]]; then
  echo "[ERROR] --test-results-file does not exist: $TEST_RESULTS_FILE" >&2
  exit 1
fi

if [[ -n "$EXTRA_INSTRUCTIONS_FILE" && ! -f "$EXTRA_INSTRUCTIONS_FILE" ]]; then
  echo "[ERROR] --extra-instructions does not exist: $EXTRA_INSTRUCTIONS_FILE" >&2
  exit 1
fi

BRANCH_NAME="$(git rev-parse --abbrev-ref "$HEAD_REF" 2>/dev/null || echo "$HEAD_REF")"
COMMIT_LINES="$(git log --no-merges --pretty=format:'- %h %s' "${BASE_REF}..${HEAD_REF}" || true)"
FILE_CHANGES="$(git diff --name-status "${BASE_REF}...${HEAD_REF}" || true)"
DIFF_STAT="$(git diff --stat "${BASE_REF}...${HEAD_REF}" || true)"
DIFF_SNIPPET="$(git diff --no-color "${BASE_REF}...${HEAD_REF}" | head -c "$MAX_DIFF_CHARS")"

if [[ -z "$COMMIT_LINES" ]]; then
  COMMIT_LINES="- (no commits between ${BASE_REF} and ${HEAD_REF})"
fi

if [[ -z "$FILE_CHANGES" ]]; then
  FILE_CHANGES="- (no changed files)"
fi

if [[ -z "$DIFF_STAT" ]]; then
  DIFF_STAT="- (no diff stat)"
fi

TEST_RESULTS_TEXT="未提供（必要なら手動で追記）"
if [[ -n "$TEST_RESULTS_FILE" ]]; then
  TEST_RESULTS_TEXT="$(cat "$TEST_RESULTS_FILE")"
fi

DOC_LINKS_TEXT="未提供"
if [[ -n "$DOC_LINKS" ]]; then
  DOC_LINKS_TEXT="$(printf '%s\n' "$DOC_LINKS" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed '/^$/d' | sed 's/^/- /')"
  if [[ -z "$DOC_LINKS_TEXT" ]]; then
    DOC_LINKS_TEXT="未提供"
  fi
fi

EXTRA_INSTRUCTIONS_TEXT="なし"
if [[ -n "$EXTRA_INSTRUCTIONS_FILE" ]]; then
  EXTRA_INSTRUCTIONS_TEXT="$(cat "$EXTRA_INSTRUCTIONS_FILE")"
fi

PROMPT="$(cat <<EOF
あなたはGitHub Pull Request本文の作成アシスタントです。以下のコンテキストから、PR本文ドラフトを日本語で作成してください。

出力ルール:
- Markdownで出力する
- 事実ベースで記載し、推測は避ける
- 「未提供」「未実行」の情報は明示する
- 次の見出しを必ずこの順で含める:
  1. ## 変更概要
  2. ## 背景・目的
  3. ## 変更点
  4. ## テスト結果
  5. ## 影響範囲
  6. ## 未対応項目
  7. ## 関連ドキュメント
  8. ## レビュー観点

Task ID / Issue:
${ISSUE_ID:-未提供}

ブランチ:
${BRANCH_NAME}

追加指示:
${EXTRA_INSTRUCTIONS_TEXT}
EOF
)"

CONTEXT_FILE="$(mktemp)"
cleanup() {
  rm -f "$CONTEXT_FILE"
}
trap cleanup EXIT

cat >"$CONTEXT_FILE" <<EOF
# 入力コンテキスト

## 比較範囲
- base: ${BASE_REF}
- head: ${HEAD_REF}

## コミット一覧
${COMMIT_LINES}

## 変更ファイル
${FILE_CHANGES}

## Diff Stat
${DIFF_STAT}

## 品質ゲート結果
${TEST_RESULTS_TEXT}

## 関連ドキュメント候補
${DOC_LINKS_TEXT}

## Unified Diff（一部）
\`\`\`diff
${DIFF_SNIPPET}
\`\`\`
EOF

GEMINI_CMD=(gemini --output-format text -p "$PROMPT")
if [[ -n "$MODEL" ]]; then
  GEMINI_CMD+=(--model "$MODEL")
fi

cat "$CONTEXT_FILE" | "${GEMINI_CMD[@]}" >"$OUTPUT_FILE"

if [[ ! -s "$OUTPUT_FILE" ]]; then
  echo "[ERROR] Gemini output is empty: $OUTPUT_FILE" >&2
  exit 1
fi

echo "[OK] PR summary generated: $OUTPUT_FILE"
