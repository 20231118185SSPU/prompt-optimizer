#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

prepare_lock_sandbox() {
  local target="$SANDBOX/lock-sandbox"
  mkdir -p "$target"
  cp -R "$ROOT/build" "$target/build"
  cp -R "$ROOT/core" "$target/core"
  mkdir -p "$target/dist"
  printf '%s\n' "$target"
}

assert_lock_blocks_build() {
  local label="$1"
  local target="$2"
  shift 2

  mkdir "$target/.build.lock"
  if ALIGN_NPM_COMMAND=prompt-optimizer-npm-missing "$@" > "$SANDBOX/$label.out" 2> "$SANDBOX/$label.err"; then
    echo "FAIL: $label build ignored an existing project build lock"
    exit 1
  fi
  if ! grep -q 'Another build is already running' "$SANDBOX/$label.err"; then
    echo "FAIL: $label build did not report the existing project build lock"
    cat "$SANDBOX/$label.err"
    exit 1
  fi
  rmdir "$target/.build.lock"

  ALIGN_NPM_COMMAND=prompt-optimizer-npm-missing "$@" > "$SANDBOX/$label-cleanup.out" 2> "$SANDBOX/$label-cleanup.err" || {
    echo "FAIL: $label WhatIf build failed after lock release"
    cat "$SANDBOX/$label-cleanup.err"
    exit 1
  }
  if [ -e "$target/.build.lock" ]; then
    echo "FAIL: $label build did not clean up its project build lock"
    exit 1
  fi
}

assert_failed_build_cleans_lock() {
  local label="$1"
  local target="$2"
  shift 2

  mv "$target/core/protocol" "$target/core/protocol-missing"
  if ALIGN_NPM_COMMAND=prompt-optimizer-npm-missing "$@" > "$SANDBOX/$label-failure.out" 2> "$SANDBOX/$label-failure.err"; then
    echo "FAIL: $label build unexpectedly succeeded with a missing required directory"
    exit 1
  fi
  mv "$target/core/protocol-missing" "$target/core/protocol"
  if [ -e "$target/.build.lock" ]; then
    echo "FAIL: $label build left its project build lock after failure"
    exit 1
  fi
}

run_what_if() {
  local label="$1"
  shift
  ALIGN_NPM_COMMAND=prompt-optimizer-npm-missing "$@" > "$SANDBOX/$label.out" 2> "$SANDBOX/$label.err" || {
    echo "FAIL: $label WhatIf build failed"
    cat "$SANDBOX/$label.err"
    exit 1
  }
  if ! grep -q 'Policy projection verified from core/contracts/decision-policy.json' "$SANDBOX/$label.out"; then
    echo "FAIL: $label build did not verify the policy projection"
    exit 1
  fi
  for asset in decision-policy.json decision-policy.schema.json reason-registry.json; do
    if ! grep -q "runtime/contracts/$asset" "$SANDBOX/$label.out"; then
      echo "FAIL: $label build did not project $asset to dist/runtime/contracts"
      exit 1
    fi
  done
}

run_no_node_what_if() {
  local label="$1"
  shift
  ALIGN_NODE_COMMAND=prompt-optimizer-node-missing ALIGN_NPM_COMMAND=prompt-optimizer-npm-missing \
    "$@" > "$SANDBOX/$label.out" 2> "$SANDBOX/$label.err" || {
      echo "FAIL: $label no-Node WhatIf build failed"
      cat "$SANDBOX/$label.err"
      exit 1
    }
  if ! grep -q 'Embedded shell policy projection matches all contract SHA-256 values' "$SANDBOX/$label.out"; then
    echo "FAIL: $label no-Node build did not verify contract hashes"
    exit 1
  fi
}

run_what_if bash bash "$ROOT/build/build.sh" --what-if
run_no_node_what_if bash-no-node bash "$ROOT/build/build.sh" --what-if

if command -v pwsh >/dev/null 2>&1; then
  PS_BIN=pwsh
elif command -v powershell >/dev/null 2>&1; then
  PS_BIN=powershell
else
  echo "FAIL: PowerShell is required for W3 build projection parity"
  exit 1
fi
run_what_if powershell "$PS_BIN" -NoProfile -ExecutionPolicy Bypass -File "$ROOT/build/build.ps1" -WhatIf
run_no_node_what_if powershell-no-node "$PS_BIN" -NoProfile -ExecutionPolicy Bypass -File "$ROOT/build/build.ps1" -WhatIf

LOCK_SANDBOX="$(prepare_lock_sandbox)"
assert_lock_blocks_build bash "$LOCK_SANDBOX" bash "$LOCK_SANDBOX/build/build.sh" --what-if
assert_lock_blocks_build powershell "$LOCK_SANDBOX" "$PS_BIN" -NoProfile -ExecutionPolicy Bypass -File "$LOCK_SANDBOX/build/build.ps1" -WhatIf

BASH_FAILURE_SANDBOX="$(prepare_lock_sandbox)"
assert_failed_build_cleans_lock bash "$BASH_FAILURE_SANDBOX" bash "$BASH_FAILURE_SANDBOX/build/build.sh" --what-if
POWERSHELL_FAILURE_SANDBOX="$(prepare_lock_sandbox)"
assert_failed_build_cleans_lock powershell "$POWERSHELL_FAILURE_SANDBOX" "$PS_BIN" -NoProfile -ExecutionPolicy Bypass -File "$POWERSHELL_FAILURE_SANDBOX/build/build.ps1" -WhatIf

echo "PASS: Bash and PowerShell build entrypoints share the policy projection and contract assets"
