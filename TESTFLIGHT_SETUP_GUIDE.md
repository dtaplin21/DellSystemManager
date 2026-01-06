# 🚀 TestFlight Beta Setup Guide

**Last Updated**: 2026-01-05  
**Status**: Ready for TestFlight Deployment

## ✅ Step 1: iOS App Configuration (COMPLETED)

### Changes Applied:
- ✅ **API Base URL**: Set to `https://geosyntec-backend.onrender.com` (production)
- ✅ **App Transport Security**: Removed localhost/IP exceptions, kept production domain exception
- ✅ **Bundle Identifier**: `Grand-Gaia.QC-APP`
- ✅ **Version**: 1.0
- ✅ **Build Number**: 1

### Current Configuration:
```xml
<!-- QC-APP-Info.plist -->
<key>API_BASE_URL</key>
<string>https://geosyntec-backend.onrender.com</string>
```

---

## 📋 Step 2: Apple Developer Account Setup

### Prerequisites:
- [ ] **Apple Developer Account** (Individual: $99/year, Organization: $99/year)
  - Sign up at: https://developer.apple.com/programs/
  - Wait for approval (usually instant for individuals, 1-2 days for organizations)

### Required Information:
- [ ] Apple ID (personal or organization email)
- [ ] Payment method (credit card)
- [ ] Legal entity information (for organization accounts)

**Action**: If you don't have an Apple Developer account, sign up now at https://developer.apple.com/programs/

---

## 🔐 Step 3: Xcode Project Configuration

### 3.1 Open Project in Xcode
```bash
# Navigate to iOS app directory
cd "QC APP"
open "QC APP.xcodeproj"
```

### 3.2 Configure Signing & Capabilities

1. **Select Project** → Click on "QC APP" project in navigator
2. **Select Target** → Click on "QC APP" under TARGETS
3. **Go to "Signing & Capabilities" tab**

#### Signing Configuration:
- [ ] **Team**: Select your Apple Developer Team
  - If not listed: Click "Add Account..." → Sign in with Apple ID
- [ ] **Bundle Identifier**: Verify `Grand-Gaia.QC-APP`
  - ⚠️ **Important**: Bundle ID must be unique. If taken, change to something like `com.yourcompany.QC-APP`
- [ ] **Automatically manage signing**: ✅ Checked
- [ ] **Provisioning Profile**: Should auto-generate

#### Capabilities to Verify:
- [ ] **Push Notifications** (if using)
- [ ] **Background Modes** (if using background uploads)
- [ ] **Camera** (required for photo capture)
- [ ] **Photo Library** (required for photo selection)

### 3.3 Update Version & Build Numbers

**Location**: Target → General → Identity

- [ ] **Version**: `1.0` (or increment for updates)
- [ ] **Build**: `1` (increment for each TestFlight build)
  - **Note**: Build number must increase with each upload

**Action**: 
- For first TestFlight build: Version `1.0`, Build `1`
- For updates: Keep Version `1.0`, increment Build to `2`, `3`, etc.

---

## 🏗️ Step 4: Build Archive for TestFlight

### 4.1 Select Generic iOS Device
1. In Xcode toolbar, click device selector (next to Play/Stop buttons)
2. Select **"Any iOS Device"** or **"Generic iOS Device"**
   - ⚠️ **Cannot archive with Simulator selected**

### 4.2 Create Archive
1. **Menu**: Product → Archive
2. **Wait**: Xcode will build and create archive (may take 2-5 minutes)
3. **Organizer Window**: Should open automatically showing your archive

### 4.3 Verify Archive
- [ ] Archive appears in Organizer (Window → Organizer)
- [ ] Archive shows correct version and build number
- [ ] No errors or warnings in archive

---

## 📤 Step 5: Upload to App Store Connect

### 5.1 App Store Connect Setup

1. **Go to**: https://appstoreconnect.apple.com
2. **Sign in** with your Apple Developer account
3. **Navigate**: My Apps → Click "+" → New App

#### App Information:
- [ ] **Platform**: iOS
- [ ] **Name**: "QC APP" (or your preferred name)
- [ ] **Primary Language**: English (or your language)
- [ ] **Bundle ID**: Select `Grand-Gaia.QC-APP` (must match Xcode)
- [ ] **SKU**: `QC-APP-001` (unique identifier, can be anything)
- [ ] **User Access**: Full Access (or Limited Access if using team)

### 5.2 Upload Archive from Xcode

**Option A: Upload from Xcode Organizer (Recommended)**
1. In Xcode Organizer, select your archive
2. Click **"Distribute App"**
3. Select **"App Store Connect"**
4. Click **"Next"**
5. Select **"Upload"** (not "Export")
6. Click **"Next"**
7. **Distribution Options**:
   - ✅ Upload your app's symbols (recommended for crash reports)
   - ✅ Manage Version and Build Number (if needed)
8. Click **"Next"**
9. **Review**: Verify app information
10. Click **"Upload"**
11. **Wait**: Upload may take 5-15 minutes depending on app size

**Option B: Upload via Transporter App**
1. Download **Transporter** from Mac App Store
2. Open Transporter
3. Drag your `.ipa` file (exported from Xcode) into Transporter
4. Click **"Deliver"**

### 5.3 Verify Upload
- [ ] Go to App Store Connect → My Apps → QC APP → TestFlight
- [ ] Wait for processing (usually 5-30 minutes)
- [ ] Status should change from "Processing" to "Ready to Submit" or "Ready to Test"

---

## 👥 Step 6: Configure TestFlight Beta Testing

### 6.1 Add Internal Testers (Optional - Fast Testing)

**Internal Testers** (up to 100):
- Must be part of your Apple Developer Team
- Can test immediately after upload (no review)
- Limited to 100 testers

**Steps**:
1. App Store Connect → My Apps → QC APP → TestFlight
2. Click **"Internal Testing"** tab
3. Click **"+"** to add testers
4. Add email addresses of team members
5. They'll receive email invitation

### 6.2 Add External Testers (Beta Testing)

**External Testers** (up to 10,000):
- Anyone with email address
- Requires App Review (usually 24-48 hours for first build)
- Can test on any device

**Steps**:
1. App Store Connect → My Apps → QC APP → TestFlight
2. Click **"External Testing"** tab
3. Click **"+"** → Create new group (e.g., "Beta Testers")
4. **Add Build**:
   - Select your uploaded build (Version 1.0, Build 1)
   - Click **"Next"**
5. **Beta App Information**:
   - **What to Test**: Describe what testers should focus on
     ```
     Please test:
     - Login and authentication
     - Project creation and selection
     - Photo capture and upload
     - Form submission
     - Offline functionality
     ```
   - **Feedback Email**: Your email for bug reports
   - **Description**: Brief description of the app
6. **Beta Review Information**:
   - **Contact Information**: Your email/phone
   - **Demo Account**: (Optional) Create test account credentials
   - **Notes**: Any special instructions for reviewers
7. Click **"Submit for Review"**
8. **Wait**: Apple review usually takes 24-48 hours for first build

### 6.3 Add Testers to Group

1. In External Testing group, click **"Testers"** tab
2. Click **"+"** → Add testers
3. **Add by Email**:
   - Enter email addresses (one per line or comma-separated)
   - Testers will receive email invitation
4. **Or Share Link**:
   - Click **"Public Link"** → Enable
   - Share the link with testers (they can join without invitation)

---

## 📱 Step 7: Testers Install App

### For Testers:

1. **Receive Email**: TestFlight invitation email from Apple
2. **Install TestFlight**:
   - Download "TestFlight" app from App Store (if not installed)
3. **Accept Invitation**:
   - Open email → Click "Start Testing" → Opens TestFlight app
   - Or open TestFlight app → Enter redemption code (if provided)
4. **Install App**:
   - In TestFlight, tap **"Install"** next to QC APP
   - App installs like a normal app
5. **Open App**: Launch from home screen

### Testing Without WiFi/Laptop:
- ✅ **Cellular Data**: App will work on cellular data (no WiFi needed)
- ✅ **No Laptop Required**: App connects directly to production backend
- ✅ **Offline Mode**: App supports offline queue (uploads when online)

---

## 🔄 Step 8: Update App for New Builds

### When You Need to Update:

1. **Make Changes** in Xcode
2. **Increment Build Number**:
   - Target → General → Build: `1` → `2` (or higher)
3. **Create New Archive**: Product → Archive
4. **Upload New Build**: Same process as Step 5
5. **Add to TestFlight Group**:
   - External Testing → Select group → "+" → Add new build
   - **Note**: External testers need review for first build only, subsequent builds are usually instant

---

## ✅ Verification Checklist

### Before First Upload:
- [ ] Apple Developer account active
- [ ] Bundle identifier configured in Xcode
- [ ] Signing & Capabilities configured
- [ ] Version and Build numbers set
- [ ] API URL points to production backend
- [ ] App builds without errors
- [ ] Archive created successfully

### After Upload:
- [ ] Build appears in App Store Connect
- [ ] Build processing completes (no errors)
- [ ] TestFlight group created
- [ ] Testers added to group
- [ ] External testing submitted for review (if first build)
- [ ] Testers receive invitations

### Testing Verification:
- [ ] App installs on test device
- [ ] App launches without crashes
- [ ] Login works with production backend
- [ ] Projects load correctly
- [ ] Photo capture works
- [ ] Uploads succeed
- [ ] Offline mode works

---

## 🚨 Common Issues & Solutions

### Issue: "No accounts with App Store Connect access"
**Solution**: 
- Xcode → Preferences → Accounts → Add Apple ID
- Ensure account has App Store Connect access

### Issue: "Bundle identifier already in use"
**Solution**: 
- Change bundle ID in Xcode to something unique
- Update in App Store Connect if app already created

### Issue: "Archive button is grayed out"
**Solution**: 
- Select "Any iOS Device" or "Generic iOS Device" (not Simulator)
- Clean build folder: Product → Clean Build Folder

### Issue: "Upload failed" or "Invalid bundle"
**Solution**: 
- Check bundle identifier matches App Store Connect
- Verify signing certificates are valid
- Ensure version/build numbers are correct

### Issue: "Build stuck in processing"
**Solution**: 
- Usually resolves in 30-60 minutes
- Check App Store Connect for error messages
- Re-upload if processing fails after 2 hours

### Issue: "Testers can't install app"
**Solution**: 
- Verify TestFlight app is installed on device
- Check invitation email was received
- Ensure iOS version meets minimum requirements (check in Xcode)

---

## 📊 TestFlight Limits

- **Internal Testers**: Up to 100 team members
- **External Testers**: Up to 10,000 testers
- **Build Retention**: 90 days (builds expire after 90 days)
- **Concurrent Builds**: Up to 100 builds per app
- **Build Size**: Up to 4GB per build

---

## 🎯 Next Steps After TestFlight Setup

1. **Monitor Feedback**: Check TestFlight feedback and crash reports
2. **Iterate**: Fix bugs and upload new builds
3. **Expand Testing**: Add more testers as needed
4. **Prepare for App Store**: Once beta is stable, prepare for App Store submission

---

## 📞 Support Resources

- **Apple Developer Support**: https://developer.apple.com/support/
- **TestFlight Documentation**: https://developer.apple.com/testflight/
- **App Store Connect Help**: https://help.apple.com/app-store-connect/
- **Xcode Documentation**: https://developer.apple.com/documentation/xcode

---

## 🎉 Summary

You're now ready to:
1. ✅ Configure Xcode signing (Step 3)
2. ✅ Build and archive your app (Step 4)
3. ✅ Upload to App Store Connect (Step 5)
4. ✅ Set up TestFlight beta testing (Step 6)
5. ✅ Distribute to testers (Step 7)

**Estimated Time**: 
- Initial setup: 1-2 hours
- First build upload: 30 minutes
- Apple review (external): 24-48 hours
- Total to first beta test: 2-3 days

Good luck with your beta launch! 🚀

