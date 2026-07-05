#!/usr/bin/env bash
set -euo pipefail

# v3.0: Install both optimize-prompt and align-init skills

VERSION="v3.0"
TARGET="all"
REPO_ZIP="${PROMPT_OPTIMIZER_ZIP:-https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip}"
WHAT_IF=0
UNINSTALL=0
TARGET_SET=0

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
      if [ "$TARGET_SET" -eq 1 ]; then
        echo "Only one target may be specified." >&2
        exit 2
      fi
      TARGET="$arg"
      TARGET_SET=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

SKILLS=("optimize-prompt" "align-init")

resolve_install_targets() {
  case "$TARGET" in
    claude)
      printf '%s|%s|%s\n' "$HOME/.claude/skills" "claude-code" "Claude Code"
      return
      ;;
    codex)
      printf '%s|%s|%s\n' "${CODEX_HOME:-$HOME/.codex}/skills" "codex" "Codex"
      return
      ;;
    agents)
      printf '%s|%s|%s\n' "$HOME/.agents/skills" "claude-code" "agents-style"
      return
      ;;
    all)
      if [ -n "${CODEX_HOME:-}" ]; then
        printf '%s|%s|%s\n' "$CODEX_HOME/skills" "codex" "Codex"
      else
        printf '%s|%s|%s\n' "$HOME/.codex/skills" "codex" "Codex"
      fi
      printf '%s|%s|%s\n' "$HOME/.claude/skills" "claude-code" "Claude Code"
      printf '%s|%s|%s\n' "$HOME/.agents/skills" "claude-code" "agents-style"
      return
      ;;
  esac
}

if [ -n "${PROMPT_OPTIMIZER_SKILLS_DIR:-}" ]; then
  CUSTOM_ADAPTER="claude-code"
  if [ "$TARGET" = "codex" ]; then
    CUSTOM_ADAPTER="codex"
  fi
  INSTALL_TARGETS="$PROMPT_OPTIMIZER_SKILLS_DIR|$CUSTOM_ADAPTER|custom"
else
  INSTALL_TARGETS="$(resolve_install_targets)"
fi

if [ "$UNINSTALL" -eq 1 ]; then
  while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
    [ -n "$SKILLS_DIR" ] || continue
    for SKILL in "${SKILLS[@]}"; do
      INSTALL_DIR="$SKILLS_DIR/$SKILL"
      if [ "$WHAT_IF" -eq 1 ]; then
        echo "What if: Remove $SKILL skill from: $INSTALL_DIR (if present)"
      elif [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        echo "Removed $SKILL skill from: $INSTALL_DIR"
      fi
    done
  done <<EOF
$INSTALL_TARGETS
EOF
  echo
  if [ "$WHAT_IF" -eq 1 ]; then
    echo 'What if: Only optimize-prompt and align-init would be removed.'
  else
    echo 'Uninstall complete. Only optimize-prompt and align-init were removed.'
  fi
  echo 'Other skills and user content were not touched.'
  exit 0
fi

if [ "$WHAT_IF" -eq 1 ]; then
  while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
    [ -n "$SKILLS_DIR" ] || continue
    for SKILL in "${SKILLS[@]}"; do
      echo "What if: Install $SKILL skill to: $SKILLS_DIR/$SKILL (source: dist/$ADAPTER)"
    done
  done <<EOF
$INSTALL_TARGETS
EOF
  echo
  echo 'What if: Skills would be downloaded from' "$REPO_ZIP"
  echo 'Note: ~/.agents/skills uses the dist/claude-code package because agents-style tools consume the Claude-compatible skill layout.'
  exit 0
fi

TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ -d "$REPO_ZIP" ]; then
  SOURCE_ROOT="$REPO_ZIP"
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
  DIST_ROOT="$(find "$TMP_DIR/repo" -path '*/dist' -type d -print -quit)"

  if [ -z "$DIST_ROOT" ]; then
    echo "Could not find dist directory in downloaded archive." >&2
    exit 1
  fi

  SOURCE_ROOT="$(dirname "$DIST_ROOT")"
fi

VALIDATED_ADAPTERS=""

validate_adapter() {
  local adapter="$1"
  local dist_source="$SOURCE_ROOT/dist/$adapter"
  local skill

  case " $VALIDATED_ADAPTERS " in
    *" $adapter "*) return ;;
  esac

  if [ ! -d "$dist_source" ]; then
    echo "Could not find dist/$adapter directory." >&2
    exit 1
  fi

  for skill in "${SKILLS[@]}"; do
    if [ ! -f "$dist_source/$skill/SKILL.md" ]; then
      echo "Could not find dist/$adapter/$skill/SKILL.md." >&2
      exit 1
    fi
  done

  VALIDATED_ADAPTERS="$VALIDATED_ADAPTERS $adapter"
}

while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
  [ -n "$SKILLS_DIR" ] || continue
  validate_adapter "$ADAPTER"
done <<EOF
$INSTALL_TARGETS
EOF

while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
  [ -n "$SKILLS_DIR" ] || continue
  DIST_SOURCE="$SOURCE_ROOT/dist/$ADAPTER"
  for SKILL in "${SKILLS[@]}"; do
    INSTALL_DIR="$SKILLS_DIR/$SKILL"
    mkdir -p "$SKILLS_DIR"
    rm -rf "$INSTALL_DIR"
    cp -R "$DIST_SOURCE/$SKILL" "$INSTALL_DIR"
    echo "Installed $SKILL skill to: $INSTALL_DIR (source: dist/$ADAPTER)"
  done
done <<EOF
$INSTALL_TARGETS
EOF

echo
echo 'Installed skills: optimize-prompt, align-init'
echo 'Use optimize-prompt with: $optimize-prompt optimize: your rough idea'
echo 'Use align-init with: /align-init (in your project directory)'
echo 'Claude Code also supports: /optimize-prompt and /align-init'
echo 'Note: ~/.agents/skills uses the dist/claude-code package because agents-style tools consume the Claude-compatible skill layout.'
