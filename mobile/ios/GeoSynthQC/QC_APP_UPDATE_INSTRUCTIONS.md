# QC APP - Next Steps After File Integration

## Current Status
✅ All Swift files have been added to the Xcode project
✅ Project structure is set up (Views, Services, Models, Utilities)
⚠️ Need to update app entry point and configure SwiftData

## Immediate Next Steps

### Step 1: Update QC_APPApp.swift

Replace the current Core Data version with this SwiftData version:

```swift
import SwiftUI
import SwiftData

@main
struct QC_APPApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: UploadQueueItem.self)
    }
}
```

**Changes:**
- Remove `import CoreData`
- Remove `PersistenceController` reference
- Add `import SwiftData`
- Add `.modelContainer(for: UploadQueueItem.self)` to enable SwiftData

### Step 2: Add UploadQueueItem Model

1. In Xcode, right-click the "Models" folder
2. Select "New File..."
3. Choose "Swift File"
4. Name it `UploadQueueItem.swift`
5. Copy the contents from the file I just created

### Step 3: Add OfflineQueueService

1. In Xcode, right-click the "Services" folder
2. Select "New File..."
3. Choose "Swift File"
4. Name it `OfflineQueueService.swift`
5. Copy the contents from the file I just created

### Step 4: Update ImageUploadService

The ImageUploadService has been updated to:
- Check network connectivity
- Automatically queue uploads when offline
- Return queued status

### Step 5: Configure Info.plist

1. Select `Info.plist` in the project
2. Add these keys:

```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to capture defect photos for quality control.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to select defect images.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>We need location to tag defect locations on the project site.</string>

<key>API_BASE_URL</key>
<string>http://localhost:8003</string>
```

### Step 6: Set Minimum iOS Version

1. Select "QC APP" target
2. Go to "General" tab
3. Set "Minimum Deployments" to **iOS 17.0** (required for SwiftData)

### Step 7: Remove Core Data Files (Optional)

Since we're using SwiftData:
1. Delete `Persistence.swift` (if not needed)
2. Remove Core Data imports from any files

### Step 8: Build and Test

1. Press ⌘B to build
2. Fix any import errors
3. Run the app (⌘R)

## Offline Queue Features

Once implemented, the app will:
- ✅ Automatically detect network status
- ✅ Queue uploads when offline
- ✅ Retry failed uploads (up to 3 times)
- ✅ Process queue automatically when connection restored
- ✅ Show queue status in UI

## Next: UI Updates

After basic integration works, we can add:
- Queue status indicator
- Queue management view
- Retry failed uploads button
- Queue count badge

