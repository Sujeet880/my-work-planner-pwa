#!/bin/bash
set -e

# My Work Planner — Native macOS Mini Focus Timer
# Build and bundle script for standalone .app packaging

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${PROJECT_DIR}/.build"
DIST_DIR="${PROJECT_DIR}/dist"
APP_NAME="MyWorkPlannerMiniTimer"
APP_BUNDLE="${DIST_DIR}/${APP_NAME}.app"

echo "=== Building My Work Planner — Mini Focus Timer ==="
cd "${PROJECT_DIR}"

# 1. Compile release binary via Swift Package Manager
echo "--> Compiling release executable with Swift Package Manager..."
swift build -c release

# 2. Locate release binary
BINARY_PATH="$(swift build -c release --show-bin-path)/${APP_NAME}"
if [ ! -f "${BINARY_PATH}" ]; then
    echo "Error: Binary not found at ${BINARY_PATH}"
    exit 1
fi
echo "--> Binary compiled at: ${BINARY_PATH}"

# 3. Assemble .app bundle structure
echo "--> Assembling ${APP_BUNDLE}..."
rm -rf "${APP_BUNDLE}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

cp "${BINARY_PATH}" "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"
chmod +x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"

cp "${PROJECT_DIR}/Resources/Info.plist" "${APP_BUNDLE}/Contents/Info.plist"

# 4. Ad-hoc code sign for local execution
echo "--> Applying ad-hoc local signature..."
codesign --force --deep --sign - "${APP_BUNDLE}"

echo "=== Build and packaging complete ==="
echo "App bundle: ${APP_BUNDLE}"
