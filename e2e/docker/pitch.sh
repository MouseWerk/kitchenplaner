#!/usr/bin/env bash
# Takes the presentation screenshots of the example kitchen (e2e/pitch/shots.js) in the Linux
# container of the end-to-end tests (see Dockerfile and run.sh). Usage from the repository root:
#   e2e/docker/pitch.sh                       # all shots and exports into pitch/
#   PITCH_ONLY=4,5 e2e/docker/pitch.sh        # some shots while working on them ("x": exports)
# PITCH_WIDTH / PITCH_HEIGHT set the window (default 2560 x 1440, the size of the virtual screen).
set -euo pipefail
cd "$(dirname "$0")/../.."
docker build -t kitchenplaner-e2e e2e/docker
# A German system locale on top, as a German user's computer has: native controls such as the
# date field format their values from it (13.10.2026, not 10/13/2026).
docker build -t kitchenplaner-e2e-pitch - <<'DOCKERFILE'
FROM kitchenplaner-e2e
RUN apt-get update && apt-get install -y --no-install-recommends locales \
    && sed -i 's/^# *de_DE.UTF-8/de_DE.UTF-8/' /etc/locale.gen && locale-gen && rm -rf /var/lib/apt/lists/*
ENV LANG=de_DE.UTF-8 LANGUAGE=de_DE:de LC_ALL=de_DE.UTF-8
DOCKERFILE
host_dir="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -t \
  -e PITCH_ONLY="${PITCH_ONLY:-}" -e PITCH_WIDTH="${PITCH_WIDTH:-}" -e PITCH_HEIGHT="${PITCH_HEIGHT:-}" \
  -v "$host_dir":/repo \
  -v kitchenplaner-e2e-target:/repo/target \
  -v kitchenplaner-e2e-cargo:/usr/local/cargo/registry \
  -v kitchenplaner-e2e-ui-modules:/repo/ui/node_modules \
  -v kitchenplaner-e2e-e2e-modules:/repo/e2e/node_modules \
  -v kitchenplaner-e2e-ui-dist:/repo/ui/dist \
  kitchenplaner-e2e-pitch bash -c '
    set -e
    npm ci --prefix ui --no-audit --no-fund
    npm ci --prefix e2e --no-audit --no-fund
    npm --prefix ui run build
    cargo build -p kitchenplaner --features custom-protocol
    [ -n "$PITCH_ONLY" ] || unset PITCH_ONLY
    [ -n "$PITCH_WIDTH" ] || unset PITCH_WIDTH
    [ -n "$PITCH_HEIGHT" ] || unset PITCH_HEIGHT
    KITCHENPLANER_APP=/repo/target/debug/kitchenplaner npm --prefix e2e run pitch
  '
