#!/usr/bin/env bash
set -euo pipefail

# v3.0: Install both optimize-prompt and align-init skills

VERSION="v3.0"
TARGET="${1:-all}"
REPO_ZIP="${PROMPT_OPTIMIZER_ZIP:-https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip}"
WHAT_IF=0
UNINSTALL=0

for arg in "$@"; do
  case "$arg" in
    --version|-version)
      echo "prompt-optimizer installer $VERSION"
      exit 0
      ;;
    --what-if|--dry-run|-WhatIf)
      WHAT_IF=1
      ;;
    --uninstall|-uninstall)
      UNINSTALL=1
      ;;
    claude|codex|agents|all)
      TARGET="$arg"
      ;;
  esac
done

SKILLS=("optimize-prompt" "align-init")

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

if [ "$UNINSTALL" -eq 1 ]; then
  while IFS= read -r SKILLS_DIR; do
    [ -n "$SKILLS_DIR" ] || continue
    for SKILL in "${SKILLS[@]}"; do
      INSTALL_DIR="$SKILLS_DIR/$SKILL"
      if [ -d "$INSTALL_DIR" ]; then
        if [ "$WHAT_IF" -eq 1 ]; then
          echo "What if: Remove $SKILL skill from: $INSTALL_DIR"
        else
          rm -rf "$INSTALL_DIR"
          echo "Removed $SKILL skill from: $INSTALL_DIR"
        fi
      fi
    done
  done <<EOF
$SKILLS_DIRS
EOF
  echo
  echo 'Uninstall complete. Only optimize-prompt and align-init were removed.'
  echo 'Other skills and user content were not touched.'
  exit 0
fi

TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ -d "$REPO_ZIP" ]; then
  DIST_SOURCE="$REPO_ZIP/dist/claude-code"
elif [ "$WHAT_IF" -eq 1 ]; then
  DIST_SOURCE=""
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
  DIST_SOURCE="$(find "$TMP_DIR/repo" -path '*/dist/claude-code' -type d -print -quit)"

  if [ -z "$DIST_SOURCE" ]; then
    echo "Could not find dist/claude-code in downloaded archive." >&2
    exit 1
  fi
fi

if [ -z "$DIST_SOURCE" ] && [ "$WHAT_IF" -eq 1 ]; then
  while IFS= read -r SKILLS_DIR; do
    [ -n "$SKILLS_DIR" ] || continue
    for SKILL in "${SKILLS[@]}"; do
      echo "What if: Install $SKILL skill to: $SKILLS_DIR/$SKILL"
    done
  done <<EOF
$SKILLS_DIRS
EOF
  echo
  echo 'What if: Skills would be downloaded from' "$REPO_ZIP"
  exit 0
fi

if [ ! -d "$DIST_SOURCE" ]; then
  echo "Could not find dist/claude-code directory." >&2
  exit 1
fi

for SKILL in "${SKILLS[@]}"; do
  SKILL_SOURCE="$DIST_SOURCE/$SKILL"
  if [ ! -f "$SKILL_SOURCE/SKILL.md" ]; then
    echo "Could not find dist/claude-code/$SKILL/SKILL.md." >&2
    exit 1
  fi
done

while IFS= read -r SKILLS_DIR; do
  [ -n "$SKILLS_DIR" ] || continue
  for SKILL in "${SKILLS[@]}"; do
    INSTALL_DIR="$SKILLS_DIR/$SKILL"
    if [ "$WHAT_IF" -eq 1 ]; then
      echo "What if: Install $SKILL skill to: $INSTALL_DIR"
    else
      mkdir -p "$SKILLS_DIR"
      rm -rf "$INSTALL_DIR"
      cp -R "$DIST_SOURCE/$SKILL" "$INSTALL_DIR"
      echo "Installed $SKILL skill to: $INSTALL_DIR"
    fi
  done
done <<EOF
$SKILLS_DIRS
EOF

echo
echo 'Installed skills: optimize-prompt, align-init'
echo 'Use optimize-prompt with: $optimize-prompt optimize: your rough idea'
echo 'Use align-init with: /align-init (in your project directory)'
echo 'Claude Code also supports: /optimize-prompt and /align-init'
