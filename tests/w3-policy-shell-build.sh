#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

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

echo "PASS: Bash and PowerShell build entrypoints share the policy projection and contract assets"
