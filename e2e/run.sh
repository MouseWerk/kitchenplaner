#!/usr/bin/env bash
# Builds the desktop app with the production UI embedded and runs the end-to-end suite against it
# (Linux: headless via Xvfb + tauri-driver + WebKitWebDriver). Usage from anywhere:
#   e2e/run.sh                              # whole suite
#   e2e/run.sh tests/05-files.test.js       # some files (paths relative to e2e/)
set -euo pipefail
cd "$(dirname "$0")/.."
npm --prefix ui run build
cargo build -p kitchenplaner --features custom-protocol
cd e2e
rm -f screenshots/FAIL-*
# Installs again when the lockfile changed since the last install (npm writes its own copy last).
[ node_modules/.package-lock.json -nt package-lock.json ] || npm ci --no-audit --no-fund
files=("${@:-tests/*.test.js}")
KITCHENPLANER_APP="$PWD/../target/debug/kitchenplaner" node --test --test-concurrency=1 --test-reporter=spec ${files[*]}
