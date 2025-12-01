# Alternative Ways to Add Info.plist Keys

## Issue: Can't Access Bottom "+" Button

If you can't see or click the "+" button at the bottom of the Info.plist table, try these solutions:

## Solution 1: Scroll Down
The table might be scrollable. Try:
- Scroll down in the Info tab content area
- Look for the "+" button below all the rows
- It should be at the very bottom of the "Custom macOS Application Target Properties" section

## Solution 2: Use Right-Click Menu
1. Right-click anywhere in the table (on an existing row)
2. Look for "Add Row" or "Insert Row" option
3. This should add a new row

## Solution 3: Create Info.plist File Directly
If the UI method isn't working, create the file manually:

1. Right-click "QC APP" folder in Project Navigator
2. Select "New File..."
3. Choose "Property List"
4. Name it `Info.plist`
5. Add it to the target
6. Then add keys directly in the file

## Solution 4: Use Build Settings
You can also add keys via Build Settings:
1. Go to "Build Settings" tab
2. Search for "Info.plist"
3. Find "Info.plist Preprocessor Definitions" or similar
4. Add keys there

## Solution 5: Edit Project File Directly (Advanced)
Edit the project.pbxproj file, but this is not recommended.

## Recommended: Try Right-Click First
Right-click on any existing row in the table and see if there's an "Add Row" option.

