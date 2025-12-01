# Fix Duplicate ContentView.swift Error

## The Problem

Your Xcode project uses **File System Synchronization** (newer Xcode feature) for the "QC APP" folder. This automatically discovers all Swift files in that folder.

However, `ContentView.swift` is also **manually added** to the "Views" group in the project navigator. This causes Xcode to try to compile it twice, resulting in:

- "Multiple commands produce..." error
- "Filename ContentView.swift used twice" error

## The Solution

You have two options:

### Option 1: Remove Manual References (Recommended)

Since the "QC APP" folder uses file system synchronization, all files are automatically discovered. You don't need to manually add them.

1. In Xcode Project Navigator, find the **"Views"** group
2. Right-click on **"ContentView.swift"** in the Views group
3. Select **"Delete"**
4. Choose **"Remove Reference"** (NOT "Move to Trash")
5. Repeat for any other files that are both in a manual group AND in the "QC APP" synchronized folder

**Note:** The file will still exist on disk and will still be compiled (via file system sync), but it won't be in the manual group anymore.

### Option 2: Disable File System Synchronization

1. Select the **"QC APP"** project (blue icon at top)
2. Select the **"QC APP"** target
3. Go to **"Build Phases"** tab
4. Find the **"Compile Sources"** section
5. Remove any files that are being auto-discovered

Or in the project file, change `PBXFileSystemSynchronizedRootGroup` to a regular `PBXGroup`, but this is more complex.

## Quick Check

After fixing, build the project (⌘B). The duplicate error should be gone.

## Why This Happens

- **File System Synchronization**: Automatically includes all files in a folder
- **Manual Groups**: Explicitly adds files to the build
- **Conflict**: Same file gets compiled twice = error

The solution is to use ONE method, not both.

