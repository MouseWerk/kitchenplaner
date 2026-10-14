#!/usr/bin/env bash
# Takes the presentation screenshots of the example kitchen (e2e/pitch/shots.js) in the Linux
# container of the end-to-end tests (see Dockerfile and run.sh). Usage from the repository root:
#   e2e/docker/pitch.sh                       # all shots and exports into pitch/
#   PITCH_ONLY=4,5 e2e/docker/pitch.sh        # some shots while working on them ("x": exports)
# The window is PITCH_WIDTH x PITCH_HEIGHT CSS pixels (default 1920 x 1080) at PITCH_SCALE device
# pixels per CSS pixel (default 2, GTK's GDK_SCALE): the pictures are 3840 x 2160 with sharp text.
# The pictures are taken from the X screen (ImageMagick), so native popups show as well.
set -euo pipefail
cd "$(dirname "$0")/../.."
docker build -t kitchenplaner-e2e e2e/docker
# On top: a German system locale, as a German user's computer has (native controls format from
# it), and the screen capture tools.
docker build -t kitchenplaner-e2e-pitch - <<'DOCKERFILE'
FROM kitchenplaner-e2e
RUN apt-get update && apt-get install -y --no-install-recommends locales imagemagick xdotool \
    && sed -i 's/^# *de_DE.UTF-8/de_DE.UTF-8/' /etc/locale.gen && locale-gen && rm -rf /var/lib/apt/lists/*
ENV LANG=de_DE.UTF-8 LANGUAGE=de_DE:de LC_ALL=de_DE.UTF-8
DOCKERFILE
host_dir="$(pwd -W 2>/dev/null || pwd)"
MSYS_NO_PATHCONV=1 docker run --rm -t \
  -e PITCH_ONLY="${PITCH_ONLY:-}" -e PITCH_WIDTH="${PITCH_WIDTH:-1920}" -e PITCH_HEIGHT="${PITCH_HEIGHT:-1080}" \
  -e PITCH_SCALE="${PITCH_SCALE:-2}" \
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
    # A virtual screen a little larger than the window in device pixels, so the whole window is
    # on it wherever GTK puts it (the harness uses a running X server as it is).
    export DISPLAY=:99
    Xvfb :99 -screen 0 $((PITCH_WIDTH * PITCH_SCALE * 5 / 4))x$((PITCH_HEIGHT * PITCH_SCALE * 5 / 4))x24 -nolisten tcp &
    xvfb=$!
    trap "kill $xvfb" EXIT
    until xdpyinfo >/dev/null 2>&1; do sleep 0.1; done
    GDK_SCALE=$PITCH_SCALE PITCH_XSHOT=1 KITCHENPLANER_APP=/repo/target/debug/kitchenplaner npm --prefix e2e run pitch
  '
