# Fix UIKit Dependency Error

## The Problem

The error "Unable to find module dependency: 'UIKit'" occurs because:
1. Your project is configured to support **both iOS and macOS**
2. **UIKit** is iOS-only (macOS uses AppKit)
3. Xcode is trying to build for macOS, where UIKit doesn't exist

## The Solution

You need to configure the project to be **iOS-only**. Here's how:

### Step 1: Change Target Platform to iOS Only

1. In Xcode, select the **"QC APP"** project (blue icon at top)
2. Select the **"QC APP"** target
3. Go to the **"General"** tab
4. Under **"Deployment Info"**:
   - **Platforms**: Select **"iOS"** only (remove macOS if it's there)
   - **Minimum Deployments**: Set to **iOS 17.0**

### Step 2: Check Build Settings

1. Go to **"Build Settings"** tab
2. Search for **"Supported Platforms"**
3. Make sure it shows: **`iphoneos iphonesimulator`** (NOT `macosx`)
4. Search for **"Base SDK"**
5. Make sure it's set to **"iOS"** or **"Latest iOS"**

### Step 3: Change Scheme Destination

1. In the top toolbar, click the scheme selector (next to the play button)
2. It probably says **"QC APP > My Mac"**
3. Change it to **"QC APP > iPhone 17 Pro"** (or any iOS Simulator)

### Step 4: Clean and Rebuild

1. Press **⌘ShiftK** (Product → Clean Build Folder)
2. Press **⌘B** (Build)

## Alternative: If You Need macOS Support

If you actually want to support macOS, you'll need to use conditional compilation:

```swift
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif
```

But for a mobile app, you should just target iOS only.

## Quick Fix Summary

**The fastest fix:**
1. Select "QC APP" target → "General" tab
2. Under "Deployment Info", make sure only **iOS** is selected
3. Change scheme from "My Mac" to an iOS Simulator
4. Clean build (⌘ShiftK) and rebuild (⌘B)

