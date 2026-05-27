#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

rm -rf dist dist-commercial-root dist-commercial-system-builder
rm -f /tmp/system-builder-commercial-root.log /tmp/system-builder-commercial-subpath.log

run_build() {
  local logfile="$1"
  shift

  "$@" > "$logfile" 2>&1 &
  local pid=$!
  local ok=0

  for _ in {1..420}; do
    if grep -q "built in" "$logfile"; then
      ok=1
      break
    fi
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      wait "$pid"
      ok=1
      break
    fi
    sleep 1
  done

  if [[ "$ok" != "1" ]]; then
    cat "$logfile"
    kill "$pid" >/dev/null 2>&1 || true
    exit 1
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    sleep 2
    kill "$pid" >/dev/null 2>&1 || true
    wait "$pid" >/dev/null 2>&1 || true
  fi

  tail -n 20 "$logfile"
}

run_build /tmp/system-builder-commercial-root.log env \
  VITE_FEATURE_MODE=commercial \
  VITE_REQUIRE_LICENSE=true \
  VITE_ENABLE_OPENCLASS=false \
  npm run build
mv dist dist-commercial-root

run_build /tmp/system-builder-commercial-subpath.log env \
  VITE_FEATURE_MODE=commercial \
  VITE_REQUIRE_LICENSE=true \
  VITE_ENABLE_OPENCLASS=false \
  VITE_BASE_PATH=/system-builder/ \
  VITE_API_BASE_URL=/system-builder/api \
  npm run build
mv dist dist-commercial-system-builder

printf "\nCommercial artifacts ready:\n"
du -sh dist-commercial-root dist-commercial-system-builder
