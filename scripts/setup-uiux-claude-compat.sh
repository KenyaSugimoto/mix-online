#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_SKILL_DIR="${ROOT_DIR}/.codex/skills/ui-ux-pro-max"
CLAUDE_SKILL_LINK="${ROOT_DIR}/.claude/skills/ui-ux-pro-max"

if [[ ! -d "${CODEX_SKILL_DIR}" ]]; then
  echo "[uiux-compat] source skill directory not found: ${CODEX_SKILL_DIR}" >&2
  echo "[uiux-compat] run 'uipro init --ai codex' first." >&2
  exit 1
fi

mkdir -p "${ROOT_DIR}/.claude/skills"

if [[ -e "${CLAUDE_SKILL_LINK}" && ! -L "${CLAUDE_SKILL_LINK}" ]]; then
  echo "[uiux-compat] existing non-symlink path blocks setup: ${CLAUDE_SKILL_LINK}" >&2
  exit 1
fi

ln -sfn ../../.codex/skills/ui-ux-pro-max "${CLAUDE_SKILL_LINK}"
echo "[uiux-compat] linked ${CLAUDE_SKILL_LINK} -> ../../.codex/skills/ui-ux-pro-max"
