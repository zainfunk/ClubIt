#!/bin/sh
# Xcode Cloud post-clone hook.
#
# Capacitor's iOS Swift Package (ios/App/CapApp-SPM/Package.swift) references
# native plugins by relative path into node_modules, e.g.
#   .package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app")
# Xcode Cloud clones the repo into /Volumes/workspace/repository but does NOT
# run `npm install`, so without this hook SPM resolution fails with:
#   the package at '.../node_modules/@capacitor/...' cannot be accessed
#
# Package.resolved itself is refreshed out-of-band by the GitHub Actions
# workflow at .github/workflows/refresh-spm-resolved.yml — Xcode Cloud's
# "Resolve packages automatically" gate refuses to update the file on the
# runner, and the toggle to turn that gate off is missing from current
# App Store Connect / Xcode UI. The GHA macOS runner has no such gate, so
# it commits a fresh Package.resolved back to main, and Xcode Cloud picks
# up the new commit on its next build.
set -eux

# Move to the repo root (Xcode Cloud sets $CI_PRIMARY_REPOSITORY_PATH).
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install Node via Homebrew if it's not already on PATH.
if ! command -v node >/dev/null 2>&1; then
  brew install node@22
  brew link node@22 --force --overwrite
fi

node --version
npm --version

# Install JS deps so node_modules/@capacitor/* exist for SPM to resolve.
# Use `npm ci` for a clean, lockfile-deterministic install.
npm ci --no-audit --no-fund

# Generate the Capacitor-managed files that ios/.gitignore excludes from
# version control:
#   - ios/App/App/capacitor.config.json
#   - ios/App/App/config.xml
#   - ios/App/App/public/ (the web bundle from webDir)
# Without these, xcodebuild fails with "couldn't be opened because there
# is no such file." Use `copy` (not `sync`) so we don't regenerate
# Package.swift on the runner.
#
# Invoke via the local binary (not `npx`) to avoid surprises — `npx` can
# decide to fetch the package over the network when it can't see it,
# which is slow and can fail in CI environments with restricted egress.
./node_modules/.bin/cap copy ios
