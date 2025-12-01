# Info.plist Setup for QC APP

## Issue
You have `info.plist.swift` which is incorrect. Info.plist should be a Property List file, not Swift.

## Solution: Use Target Info Tab (Easiest Method)

### Step 1: Delete the incorrect file
1. In Xcode, right-click `info.plist.swift` in the Project Navigator
2. Select "Delete"
3. Choose "Move to Trash"

### Step 2: Configure via Target Info Tab
1. Select "QC APP" target (under TARGETS in left sidebar)
2. Click the **"Info"** tab at the top
3. You'll see a table with keys and values

### Step 3: Add Required Keys
Click the "+" button and add these keys one by one:

**1. NSCameraUsageDescription**
- Key: `Privacy - Camera Usage Description`
- Type: `String`
- Value: `We need camera access to capture defect photos for quality control.`

**2. NSPhotoLibraryUsageDescription**
- Key: `Privacy - Photo Library Usage Description`
- Type: `String`
- Value: `We need photo library access to select defect images.`

**3. NSLocationWhenInUseUsageDescription**
- Key: `Privacy - Location When In Use Usage Description`
- Type: `String`
- Value: `We need location to tag defect locations on the project site.`

**4. API_BASE_URL** (Custom key)
- Key: `API_BASE_URL`
- Type: `String`
- Value: `http://localhost:8003`

## Alternative: Create Info.plist File

If you prefer a file-based approach:

1. Right-click "QC APP" folder
2. Select "New File..."
3. Choose "Property List"
4. Name it `Info.plist`
5. Add the keys above
6. In Build Settings, set "Info.plist File" to `QC APP/Info.plist`

