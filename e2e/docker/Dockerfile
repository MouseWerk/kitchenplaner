# Linux environment for the end-to-end tests, for machines that cannot run them natively (macOS:
# WKWebView has no WebDriver; Windows without a matching msedgedriver). Mirrors the "e2e" job of
# .github/workflows/ci.yml. Used by e2e/docker/run.sh.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git build-essential pkg-config \
      libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev webkit2gtk-driver \
      xvfb x11-utils dbus \
    && rm -rf /var/lib/apt/lists/*
# Node 22 as in CI; WebdriverIO 10 needs 22.23.4 or later (e2e/package.json, engines).
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/* \
    && node -e 'const [a, b, c] = process.versions.node.split(".").map(Number); if (a !== 22 || b < 23 || (b === 23 && c < 4)) { console.error(`Node ${process.version} is older than 22.23.4`); process.exit(1); }'
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.94.1 \
    && cargo install tauri-driver --locked
WORKDIR /repo
