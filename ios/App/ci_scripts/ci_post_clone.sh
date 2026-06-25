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

# Generate the Capacitor-managed files that ios/.gitignore excludes
# from version control:
#   - ios/App/App/capacitor.config.json
#   - ios/App/App/config.xml
#   - ios/App/App/public/ (the web bundle from webDir)
# Without these, xcodebuild fails with "couldn't be opened because there
# is no such file." Use `copy` (not `sync`) so we don't regenerate
# Package.swift on the runner.
npx --no-install cap copy ios

# Refresh Package.resolved on the runner. Xcode Cloud has "automatic
# dependency resolution disabled" by default, so if any transitive SPM
# dependency was added (e.g. GoogleSignIn-iOS pulls in Alamofire via the
# Capgo social login plugin), the committed Package.resolved is stale and
# the build is rejected with:
#   "an out-of-date resolved file was detected ... which is not allowed
#    when automatic dependency resolution is disabled"
# Running -resolvePackageDependencies rewrites Package.resolved in place so
# the subsequent build step sees an up-to-date file.
REPO="$CI_PRIMARY_REPOSITORY_PATH"
SPM_DIR="$REPO/ios/App/CapApp-SPM"
RESOLVED_DST="$REPO/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

# Xcode Cloud's workflow has "Resolve packages automatically" OFF, which
# makes BOTH of these fail under xcodebuild:
#   - resolving a missing Package.resolved -> "a resolved file is required"
#   - resolving a stale Package.resolved   -> "out-of-date resolved file"
# xcodebuild -resolvePackageDependencies respects the same gate, so it
# can't fix either case on the runner.
#
# Workaround: generate Package.resolved with the Swift Package Manager
# CLI (which doesn't honor that Xcode setting) against the same
# Package.swift Xcode reads, then copy it into the path xcodebuild
# expects. By the time the build action runs, the file is present and
# matches Package.swift exactly, so the gate is satisfied.
swift package --package-path "$SPM_DIR" resolve

mkdir -p "$(dirname "$RESOLVED_DST")"
cp "$SPM_DIR/Package.resolved" "$RESOLVED_DST"

ls -la "$RESOLVED_DST"
