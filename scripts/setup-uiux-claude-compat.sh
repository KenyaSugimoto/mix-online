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
mkdir -p "${ROOT_DIR}/.codex/skills"

if [[ -e "${CLAUDE_SKILL_LINK}" && ! -L "${CLAUDE_SKILL_LINK}" ]]; then
  echo "[uiux-compat] existing non-symlink path blocks setup: ${CLAUDE_SKILL_LINK}" >&2
  exit 1
fi

ln -sfn ../../.codex/skills/ui-ux-pro-max "${CLAUDE_SKILL_LINK}"
echo "[uiux-compat] linked ${CLAUDE_SKILL_LINK} -> ../../.codex/skills/ui-ux-pro-max"

sync_design_skill() {
  local skill_name="$1"
  local source_dir="${ROOT_DIR}/.agents/skills/${skill_name}"
  local codex_link="${ROOT_DIR}/.codex/skills/${skill_name}"
  local claude_link="${ROOT_DIR}/.claude/skills/${skill_name}"

  if [[ ! -d "${source_dir}" ]]; then
    echo "[uiux-compat] skip ${skill_name}: source not found at ${source_dir}"
    return 0
  fi

  if [[ -e "${codex_link}" && ! -L "${codex_link}" ]]; then
    echo "[uiux-compat] existing non-symlink path blocks setup: ${codex_link}" >&2
    exit 1
  fi

  if [[ -e "${claude_link}" && ! -L "${claude_link}" ]]; then
    echo "[uiux-compat] existing non-symlink path blocks setup: ${claude_link}" >&2
    exit 1
  fi

  ln -sfn ../../.agents/skills/"${skill_name}" "${codex_link}"
  ln -sfn ../../.codex/skills/"${skill_name}" "${claude_link}"
  echo "[uiux-compat] linked ${codex_link} -> ../../.agents/skills/${skill_name}"
  echo "[uiux-compat] linked ${claude_link} -> ../../.codex/skills/${skill_name}"
}

sync_design_skill "frontend-design"
sync_design_skill "web-design-guidelines"
