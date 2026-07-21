#!/usr/bin/env bash
# prompt-optimizer: canonical-router-wrapper v1
# Compatibility entrypoint. Canonical routing lives in core/host/align-route.sh.
set -u

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || {
  printf '%s\n' 'align router unavailable: cannot resolve compatibility entrypoint' >&2
  exit 2
}
CANONICAL_ROUTER="$SCRIPT_DIR/host/align-route.sh"

if [ ! -f "$CANONICAL_ROUTER" ]; then
  printf '%s\n' "align router unavailable: $CANONICAL_ROUTER" >&2
  exit 2
fi

exec bash "$CANONICAL_ROUTER" "$@"
