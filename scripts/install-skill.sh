#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-all}"
REPO_ZIP="${PROMPT_OPTIMIZER_ZIP:-https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip}"

resolve_skills_dirs() {
  case "$TARGET" in
    claude)
      printf '%s\n' "$HOME/.claude/skills"
      return
      ;;
    codex)
      printf '%s\n' "${CODEX_HOME:-$HOME/.codex}/skills"
      return
      ;;
    agents)
      printf '%s\n' "$HOME/.agents/skills"
      return
      ;;
    all)
      if [ -n "${CODEX_HOME:-}" ]; then
        printf '%s\n' "$CODEX_HOME/skills"
      else
        printf '%s\n' "$HOME/.codex/skills"
      fi
      printf '%s\n' "$HOME/.claude/skills"
      printf '%s\n' "$HOME/.agents/skills"
      return
      ;;
  esac

  if [ -n "${CODEX_HOME:-}" ]; then
    printf '%s\n' "$CODEX_HOME/skills"
  elif [ -d "$HOME/.codex/skills" ]; then
    printf '%s\n' "$HOME/.codex/skills"
  elif [ -d "$HOME/.claude/skills" ]; then
    printf '%s\n' "$HOME/.claude/skills"
  elif [ -d "$HOME/.agents/skills" ]; then
    printf '%s\n' "$HOME/.agents/skills"
  else
    printf '%s\n' "$HOME/.codex/skills"
  fi
}

if [ -n "${PROMPT_OPTIMIZER_SKILLS_DIR:-}" ]; then
  SKILLS_DIRS="$PROMPT_OPTIMIZER_SKILLS_DIR"
else
  SKILLS_DIRS="$(resolve_skills_dirs)"
fi
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ -d "$REPO_ZIP" ]; then
  SKILL_SOURCE="$REPO_ZIP/agent-skills/optimize-prompt"
else
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$REPO_ZIP" -o "$TMP_DIR/repo.zip"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$REPO_ZIP" -O "$TMP_DIR/repo.zip"
  else
    echo "curl or wget is required to download the skill archive." >&2
    exit 1
  fi

  unzip -q "$TMP_DIR/repo.zip" -d "$TMP_DIR/repo"
  SKILL_SOURCE="$(find "$TMP_DIR/repo" -path '*/agent-skills/optimize-prompt/SKILL.md' -print -quit)"

  if [ -z "$SKILL_SOURCE" ]; then
    echo "Could not find agent-skills/optimize-prompt in downloaded archive." >&2
    exit 1
  fi

  SKILL_SOURCE="$(dirname "$SKILL_SOURCE")"
fi

if [ ! -f "$SKILL_SOURCE/SKILL.md" ]; then
  echo "Could not find agent-skills/optimize-prompt/SKILL.md." >&2
  exit 1
fi

while IFS= read -r SKILLS_DIR; do
  [ -n "$SKILLS_DIR" ] || continue
  INSTALL_DIR="$SKILLS_DIR/optimize-prompt"
  mkdir -p "$SKILLS_DIR"
  rm -rf "$INSTALL_DIR"
  cp -R "$SKILL_SOURCE" "$INSTALL_DIR"
  echo "Installed optimize-prompt skill to: $INSTALL_DIR"
done <<EOF
$SKILLS_DIRS
EOF

echo
echo 'Use it with: $optimize-prompt optimize: your rough idea'
echo 'Claude Code also supports: /optimize-prompt optimize: your rough idea'

