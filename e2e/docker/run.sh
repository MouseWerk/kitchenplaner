#!/usr/bin/env bash
# Runs the end-to-end tests in a Linux container (see Dockerfile). Usage from the repository root:
#   e2e/docker/run.sh                                   # whole suite
#   e2e/docker/run.sh tests/05-files.test.js            # some files (paths relative to e2e/)
# The Linux build output and node_modules live in Docker volumes, so the host's own target/ and
# node_modules stay untouched. Needs Docker Desktop, OrbStack or Colima.
set -euo pipefail
cd "$(dirname "$0")/../.."
docker build -t kitchenplaner-e2e e2e/docker
files=("${@:-tests/*.test.js}")
# Docker Desktop on Windows needs the Windows form of the checkout's path (F:/...), which Git
# Bash's `pwd -W` gives; elsewhere `pwd -W` fails and the plain path is right. MSYS_NO_PATHCONV
# keeps Git Bash from rewriting the container paths (/repo/...) into Windows paths; other shells
# ignore it.
host_dir="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -t \
  -v "$host_dir":/repo \
  -v kitchenplaner-e2e-target:/repo/target \
  -v kitchenplaner-e2e-cargo:/usr/local/cargo/registry \
  -v kitchenplaner-e2e-ui-modules:/repo/ui/node_modules \
  -v kitchenplaner-e2e-e2e-modules:/repo/e2e/node_modules \
  -v kitchenplaner-e2e-ui-dist:/repo/ui/dist \
  kitchenplaner-e2e bash -c "
    set -e
    npm ci --prefix ui --no-audit --no-fund
    npm ci --prefix e2e --no-audit --no-fund
    npm --prefix ui run build
    cargo build -p kitchenplaner --features custom-protocol
    cd e2e && rm -f screenshots/FAIL-*
    KITCHENPLANER_APP=/repo/target/debug/kitchenplaner node --test --test-concurrency=1 --test-reporter=spec ${files[*]}
  "
