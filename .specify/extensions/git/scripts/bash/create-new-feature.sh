#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

exec node "$REPO_ROOT/scripts/feature-identity.mjs" start "$@"
