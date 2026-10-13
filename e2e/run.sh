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
[ -d node_modules ] || npm ci --no-audit --no-fund
files=("${@:-tests/*.test.js}")
KITCHENPLANER_APP="$PWD/../target/debug/kitchenplaner" node --test --test-concurrency=1 --test-reporter=spec ${files[*]}
