# Windows: builds the desktop app with the production UI embedded and runs the end-to-end suite
# (tauri-driver + msedgedriver; see e2e/README.md for the driver that must match WebView2).
#   e2e\run.ps1                             # whole suite
#   e2e\run.ps1 tests\05-files.test.js      # some files (paths relative to e2e\)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
npm --prefix "$root\ui" run build
if ($LASTEXITCODE) { exit $LASTEXITCODE }
cargo build --manifest-path "$root\Cargo.toml" -p kitchenplaner --features custom-protocol
if ($LASTEXITCODE) { exit $LASTEXITCODE }
Push-Location $PSScriptRoot
try {
  Remove-Item screenshots\FAIL-* -ErrorAction SilentlyContinue
  if (-not (Test-Path node_modules)) { npm ci --no-audit --no-fund; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
  $files = if ($args.Count) { $args } else { Get-ChildItem tests\*.test.js | ForEach-Object { "tests\$($_.Name)" } }
  $env:KITCHENPLANER_APP = "$root\target\debug\kitchenplaner.exe"
  node --test --test-concurrency=1 --test-reporter=spec @files
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
