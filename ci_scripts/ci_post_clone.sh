#!/bin/sh
# Xcode Cloud post-clone hook.
#
# Capacitor's iOS Swift Package (ios/App/CapApp-SPM/Package.swift) references
# native plugins by relative path into node_modules, e.g.
#   .package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app")
# Xcode Cloud clones the repo into /Volumes/workspace/repository but does NOT
# run `npm install`, so SPM resolution fails with:
#   the package at '.../node_modules/@capacitor/...' cannot be accessed
# We fix that by installing Node + JS deps here, before xcodebuild runs.
set -eux

# Move to the repo root (Xcode Cloud sets $CI_PRIMARY_REPOSITORY_PATH).
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install Node via Homebrew if it's not already on PATH.
if ! command -v node >/dev/null 2>&1; then
  brew install node@20
  brew link node@20 --force --overwrite
fi

node --version
npm --version

# Install JS deps so node_modules/@capacitor/* exist for SPM to resolve.
# Use `npm ci` for a clean, lockfile-deterministic install.
npm ci --no-audit --no-fund
