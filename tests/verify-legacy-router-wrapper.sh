#!/usr/bin/env bash
# verify-legacy-router-wrapper.sh — legacy entrypoint must delegate to the canonical router.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LEGACY="$ROOT/core/hook-router.sh"
CANONICAL="$ROOT/core/host/align-route.sh"

for mode in --classify --decision; do
  prompt='只修改 README.md 的版本号从 1.0.0 改为 1.0.1，并运行 markdownlint 验证。'
  legacy_output="$(ALIGN_ARBITER=off bash "$LEGACY" "$mode" "$prompt")"
  canonical_output="$(ALIGN_ARBITER=off bash "$CANONICAL" "$mode" "$prompt")"
  if [ "$legacy_output" != "$canonical_output" ]; then
    printf 'FAIL: %s output differs from canonical router\n' "$mode" >&2
    exit 1
  fi
done

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
cp "$LEGACY" "$SANDBOX/hook-router.sh"

set +e
error_output="$(bash "$SANDBOX/hook-router.sh" --decision 'test' 2>&1)"
status=$?
set -e

if [ "$status" -ne 2 ]; then
  printf 'FAIL: missing canonical router must exit 2, got %s\n' "$status" >&2
  exit 1
fi
if ! printf '%s\n' "$error_output" | grep -q 'align router unavailable'; then
  printf 'FAIL: missing canonical router did not report fail-closed error\n' >&2
  exit 1
fi

printf '%s\n' 'PASS: legacy router wrapper delegates exactly and fails closed'
