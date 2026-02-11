#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

readonly TARGET_PATHS=("apps")
readonly FILE_GLOBS=(--glob "*.ts" --glob "*.tsx")
readonly RULES=(
  "FIXED_LIMIT:BettingStructure.FIXED_LIMIT"
  "STUD_HI:GameType.STUD_HI"
  "RAZZ:GameType.RAZZ"
  "STUD_8:GameType.STUD_8"
)

violations=0

echo "[check-contract-literals] contract literals scan started"

for rule in "${RULES[@]}"; do
  literal="${rule%%:*}"
  reference="${rule#*:}"
  matches="$(rg -n --fixed-strings "${FILE_GLOBS[@]}" "\"${literal}\"" "${TARGET_PATHS[@]}" || true)"

  if [[ -n "$matches" ]]; then
    if [[ $violations -eq 0 ]]; then
      echo
      echo "Detected hard-coded contract literals:"
    fi
    violations=1
    echo
    echo "- \"${literal}\" (use ${reference})"
    echo "$matches"
  fi
done

if [[ $violations -ne 0 ]]; then
  echo
  echo "[check-contract-literals] failed"
  exit 1
fi

echo "[check-contract-literals] passed"
