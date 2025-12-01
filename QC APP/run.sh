#!/bin/bash
# Quick run script for QC APP

cd "$(dirname "$0")"
PROJECT="QC APP.xcodeproj"
SCHEME="QC APP"
SIMULATOR="iPhone 15 Pro"

echo "Building $SCHEME..."
xcodebuild -project "$PROJECT" \
  -scheme "$SCHEME" \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=$SIMULATOR" \
  -derivedDataPath build \
  build

if [ $? -eq 0 ]; then
  echo "Build successful! Installing on simulator..."
  xcrun simctl boot "$SIMULATOR" 2>/dev/null || true
  xcrun simctl install booted "build/Build/Products/Debug-iphonesimulator/QC APP.app"
  xcrun simctl launch booted "Grand-Gaia.QC-APP"
  echo "App launched!"
else
  echo "Build failed!"
  exit 1
fi
