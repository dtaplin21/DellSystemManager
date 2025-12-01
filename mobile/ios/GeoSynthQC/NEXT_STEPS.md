# Next Steps After Info.plist Configuration

## ✅ Completed
- Info.plist keys added (Camera, Photo Library, Location, API_BASE_URL)

## 🔧 Fix Build Errors

### Step 1: Fix Duplicate ContentView.swift Error

**Problem:** Xcode sees two `ContentView.swift` files and doesn't know which one to use.

**Solution:**
1. In Xcode Project Navigator, find both `ContentView.swift` files:
   - One in `QC APP/Views/ContentView.swift`
   - One in `mobile/ios/GeoSynthQC/GeoSynthQC/Views/ContentView.swift` (if it's added to the project)

2. **Remove the duplicate:**
   - Right-click on the duplicate file (the one NOT in your main project structure)
   - Select "Delete"
   - Choose "Remove Reference" (NOT "Move to Trash" - keep the file on disk)
   - This removes it from the Xcode project but keeps the file

3. **Verify:** Only ONE `ContentView.swift` should be in the project now

### Step 2: Fix SwiftData Import (Already Fixed)
✅ Fixed `import swiftData` → `import SwiftData` in `QC_APPApp.swift`

### Step 3: Set Minimum iOS Version

1. Select "QC APP" target
2. Go to **"General"** tab
3. Under **"Deployment Info"**, set:
   - **Minimum Deployments:** `iOS 17.0` (required for SwiftData)
   - **Supported Destinations:** iPhone, iPad

### Step 4: Add Missing Dependencies

The app uses **Alamofire** for networking. Add it:

1. Select "QC APP" project (top of navigator)
2. Select "QC APP" target
3. Go to **"Package Dependencies"** tab
4. Click **"+"** button
5. Enter: `https://github.com/Alamofire/Alamofire.git`
6. Click "Add Package"
7. Select version: **"Up to Next Major Version"** → `5.9.1`
8. Click "Add Package"
9. Make sure "Alamofire" is checked for "QC APP" target
10. Click "Add Package"

### Step 5: Build and Test

1. Press **⌘B** (Command + B) to build
2. Fix any remaining errors:
   - Missing imports
   - Type mismatches
   - Missing files

### Step 6: Run the App

1. Select a simulator (iPhone 15 Pro, iOS 17.0+)
2. Press **⌘R** (Command + R) to run
3. Test:
   - Login screen appears
   - Can navigate to projects
   - Can capture/select photos

## Common Issues & Fixes

### Issue: "Cannot find 'Alamofire' in scope"
**Fix:** Add Alamofire package dependency (Step 4 above)

### Issue: "UploadQueueItem is not a valid model"
**Fix:** Make sure `UploadQueueItem.swift` is in the project and uses `@Model` macro

### Issue: "API_BASE_URL not found"
**Fix:** Verify Info.plist has the key (you already added it)

### Issue: Build succeeds but app crashes on launch
**Fix:** Check console for errors, verify all services are initialized properly

## Ready to Test!

Once build succeeds, you can:
1. Test login flow
2. Test project creation
3. Test photo capture
4. Test upload functionality

