#!/usr/bin/env bash
# G4 gate: slim entry, reachable hard gates, branch references, and SSOT markers.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE_BYTES=63089
MAX_BYTES=$((BASELINE_BYTES / 2))
fail=0

for host in claude-code codex cursor; do
  if [ "$host" = cursor ]; then
    skill="$ROOT/dist/cursor/rules/align.mdc"
  else
    skill="$ROOT/dist/$host/optimize-prompt/SKILL.md"
  fi
  bytes="$(wc -c < "$skill" | tr -d '[:space:]')"
  if [ "$bytes" -gt "$MAX_BYTES" ]; then
    echo "FAIL: $host entry is $bytes bytes; budget is $MAX_BYTES"
    fail=1
  fi
  if grep -q '<!-- source: core/protocol/' "$skill"; then
    echo "FAIL: $host entry still embeds the full protocol"
    fail=1
  fi
  for required in 'pass.*enrich.*clarify.*block' 'D5=0' '总分.*<6' '\[假设\]>2' '\[直出\].*presentation' 'execution receipt' 'protocol-intent.md' 'protocol-contract.md' 'protocol-verification.md' 'protocol-precipitation.md'; do
    if ! grep -qE "$required" "$skill"; then
      echo "FAIL: $host entry lacks hard gate/pointer: $required"
      fail=1
    fi
  done
done

grep -q 'Standalone L0 copy-paste artifact; not a resident skill entry.' "$ROOT/dist/universal/SYSTEM-PROMPT.md" || {
  echo 'FAIL: universal full prompt lacks its non-resident L0 scope marker'
  fail=1
}
grep -q '禁止手动修改' "$ROOT/dist/claude-code/align-init/references/align-context.md" || {
  echo 'FAIL: legacy context template still permits a second writable SSOT'
  fail=1
}
grep -q 'writeContextProjection' "$ROOT/dist/runtime/runtime/index.js" || {
  echo 'FAIL: generated runtime lacks executable context projection support'
  fail=1
}

for reference_root in \
  "$ROOT/dist/universal/references" \
  "$ROOT/dist/claude-code/optimize-prompt/references" \
  "$ROOT/dist/codex/optimize-prompt/references" \
  "$ROOT/dist/cursor/references"; do
  for reference in protocol-intent protocol-routing protocol-contract protocol-verification protocol-precipitation; do
    file="$reference_root/$reference.md"
    if [ ! -s "$file" ] || ! grep -q 'When to read:' "$file" || ! grep -q 'Generated from core/' "$file"; then
      echo "FAIL: missing or untraceable branch reference: $file"
      fail=1
    fi
  done
done

for protocol in 00-positioning.md 01-intent-probe.md 02-diagnosis.md 03-routing.md 04-transform-rules.md 05-contract-check.md 06-lifecycle-gates.md 07-precipitation.md; do
  count="$(grep -h "source: core/protocol/$protocol" "$ROOT"/dist/claude-code/optimize-prompt/references/protocol-*.md | wc -l | tr -d '[:space:]')"
  if [ "$count" -ne 1 ]; then
    echo "FAIL: protocol source $protocol appears $count times across branch references"
    fail=1
  fi
done

for template in align-facts align-glossary align-state; do
  if [ ! -s "$ROOT/dist/claude-code/align-init/references/$template.md" ]; then
    echo "FAIL: missing classified context template: $template"
    fail=1
  fi
done
grep -q 'updatedAt' "$ROOT/dist/claude-code/align-init/references/align-state.md" || { echo 'FAIL: state template lacks updatedAt'; fail=1; }
grep -q 'invalidWhen' "$ROOT/dist/claude-code/align-init/references/align-state.md" || { echo 'FAIL: state template lacks invalidWhen'; fail=1; }

[ "$fail" -eq 0 ] || exit 1
echo "PASS: optimize-prompt entry is under 50% baseline and hard gates remain reachable"
