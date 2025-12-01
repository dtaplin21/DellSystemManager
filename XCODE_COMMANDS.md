# Xcode Project - Commands to Run

## Project Location
```
QC APP/QC APP.xcodeproj
```

## Method 1: Open in Xcode (Recommended)

### Open the Project
```bash
open "QC APP/QC APP.xcodeproj"
```

Or navigate to the project folder and double-click `QC APP.xcodeproj`

### Build and Run in Xcode
1. **Select a Simulator or Device:**
   - Click the device selector in the top toolbar (next to the play button)
   - Choose an iOS Simulator (e.g., "iPhone 15 Pro" or "iPhone 17 Pro")
   - Make sure it's an iOS Simulator, NOT "My Mac"

2. **Build the Project:**
   - Press `⌘B` (Command + B)
   - Or: Product → Build

3. **Run the App:**
   - Press `⌘R` (Command + R)
   - Or: Product → Run
   - Or: Click the Play button in the toolbar

4. **Clean Build (if needed):**
   - Press `⌘ShiftK` (Command + Shift + K)
   - Or: Product → Clean Build Folder

## Method 2: Command Line (Terminal)

### Prerequisites
Make sure you have Xcode Command Line Tools installed:
```bash
xcode-select --install
```

### List Available Simulators
```bash
xcrun simctl list devices available
```

### Build the Project
```bash
cd "QC APP"
xcodebuild -project "QC APP.xcodeproj" \
  -scheme "QC APP" \
  -sdk iphonesimulator \
  -configuration Debug \
  build
```

### Build and Run on Simulator
```bash
# Build and run on default simulator
xcodebuild -project "QC APP.xcodeproj" \
  -scheme "QC APP" \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  build

# Then install and run
xcrun simctl boot "iPhone 15 Pro" 2>/dev/null || true
xcrun simctl install booted "build/Debug-iphonesimulator/QC APP.app"
xcrun simctl launch booted "Grand-Gaia.QC-APP"
```

### Quick Build and Run Script
```bash
#!/bin/bash
cd "QC APP"
SIMULATOR="iPhone 15 Pro"

# Build
xcodebuild -project "QC APP.xcodeproj" \
  -scheme "QC APP" \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=$SIMULATOR" \
  -derivedDataPath build \
  build

# Boot simulator
xcrun simctl boot "$SIMULATOR" 2>/dev/null || true

# Install app
xcrun simctl install booted "build/Build/Products/Debug-iphonesimulator/QC APP.app"

# Launch app
xcrun simctl launch booted "Grand-Gaia.QC-APP"
```

## Common Commands

### Clean Build Folder
```bash
xcodebuild -project "QC APP/QC APP.xcodeproj" \
  -scheme "QC APP" \
  clean
```

### List Schemes
```bash
xcodebuild -project "QC APP/QC APP.xcodeproj" -list
```

### Build for Specific Configuration
```bash
# Debug
xcodebuild -project "QC APP/QC APP.xcodeproj" \
  -scheme "QC APP" \
  -configuration Debug \
  build

# Release
xcodebuild -project "QC APP/QC APP.xcodeproj" \
  -scheme "QC APP" \
  -configuration Release \
  build
```

### Archive for Distribution
```bash
xcodebuild -project "QC APP/QC APP.xcodeproj" \
  -scheme "QC APP" \
  -configuration Release \
  archive \
  -archivePath "build/QC APP.xcarchive"
```

## Troubleshooting

### Fix "No such module" Errors
```bash
# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Rebuild
cd "QC APP"
xcodebuild clean build
```

### Fix Simulator Issues
```bash
# List all simulators
xcrun simctl list devices

# Erase a simulator
xcrun simctl erase "iPhone 15 Pro"

# Shutdown all simulators
xcrun simctl shutdown all
```

### Check Build Settings
```bash
xcodebuild -project "QC APP/QC APP.xcodeproj" \
  -scheme "QC APP" \
  -showBuildSettings
```

## Quick Reference

| Action | Xcode GUI | Command Line |
|--------|-----------|--------------|
| Open Project | Double-click `.xcodeproj` | `open "QC APP/QC APP.xcodeproj"` |
| Build | `⌘B` | `xcodebuild -project "QC APP/QC APP.xcodeproj" -scheme "QC APP" build` |
| Run | `⌘R` | Use `xcrun simctl` after build |
| Clean | `⌘ShiftK` | `xcodebuild clean` |
| Stop | `⌘.` | `⌘C` in terminal |

## Recommended Workflow

1. **First Time Setup:**
   ```bash
   open "QC APP/QC APP.xcodeproj"
   ```
   Then configure in Xcode:
   - Select iOS Simulator (not "My Mac")
   - Set minimum iOS version to 17.0
   - Add dependencies (Alamofire if needed)

2. **Daily Development:**
   - Use Xcode GUI (`⌘R` to run)
   - Or use the quick script above for command line

3. **For CI/CD:**
   - Use `xcodebuild` commands
   - Automate with scripts

