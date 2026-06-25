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

# Refresh Package.resolved on the runner. Xcode Cloud has "automatic
# dependency resolution disabled" by default, so if any transitive SPM
# dependency was added (e.g. GoogleSignIn-iOS pulls in Alamofire via the
# Capgo social login plugin), the committed Package.resolved is stale and
# the build is rejected with:
#   "an out-of-date resolved file was detected ... which is not allowed
#    when automatic dependency resolution is disabled"
# Running -resolvePackageDependencies rewrites Package.resolved in place so
# the subsequent build step sees an up-to-date file.
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"

# Xcode Cloud's workflow has "automatic dependency resolution disabled,"
# which makes even `xcodebuild -resolvePackageDependencies` refuse to
# rewrite an existing Package.resolved that has missing entries. But a
# missing file isn't "out of date" — it's just absent — so xcodebuild
# will happily create a fresh one from Package.swift. Delete first,
# then resolve.
rm -f App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved

# No -scheme: this project has no shared .xcscheme committed, and the
# resolver doesn't need one — -project is sufficient to walk Package.swift.
xcodebuild \
  -resolvePackageDependencies \
  -project App.xcodeproj
