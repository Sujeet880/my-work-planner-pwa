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

# 4. Code sign with consistent bundle identifier
echo "--> Checking available code signing identities..."
SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "Apple Development" | head -n 1 | awk -F '"' '{print $2}' || true)
if [ -n "${SIGNING_IDENTITY}" ]; then
    echo "--> Signing with Apple Development identity: ${SIGNING_IDENTITY}..."
    codesign --force --deep --sign "${SIGNING_IDENTITY}" --identifier "com.myworkplanner.minitimer" "${APP_BUNDLE}"
else
    echo "--> No Apple Development identity installed in Keychain. Applying ad-hoc code signature (--sign -)..."
    codesign --force --deep --sign - --identifier "com.myworkplanner.minitimer" "${APP_BUNDLE}"
fi

# 5. Install to user Applications directory and register with LaunchServices
echo "--> Installing to ~/Applications/${APP_NAME}.app..."
pkill -f "${APP_NAME}" || true
rm -rf "${HOME}/Applications/${APP_NAME}.app"
cp -R "${APP_BUNDLE}" "${HOME}/Applications/${APP_NAME}.app"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${HOME}/Applications/${APP_NAME}.app"

echo "=== Build and packaging complete ==="
echo "App installed at: ${HOME}/Applications/${APP_NAME}.app"
