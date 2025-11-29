# GeoSynth QC iOS Mobile App

## Overview

This is the iOS mobile app for GeoSynth QC Pro, focused on defect detection and photo capture. The app allows field technicians to:

- Capture defect photos using the device camera
- Upload photos for AI-powered defect detection
- Automatically populate panel layouts on the web app via browser automation

## Features

- **Authentication**: Secure login using Supabase
- **Project Management**: Select or create projects
- **Defect Capture**: Camera and photo library integration
- **Image Upload**: Automatic compression and upload to backend
- **Defect Detection**: AI-powered defect analysis using GPT-4o
- **Browser Automation**: Automatic panel layout population on web app

## Project Structure

```
GeoSynthQC/
├── Models/              # Data models
├── Services/            # Business logic and API clients
├── Views/               # SwiftUI views
├── ViewModels/          # View models (if needed)
├── Utilities/           # Helper utilities
└── Resources/           # Assets and configuration
```

## Setup Instructions

### Prerequisites

- Xcode 15.0 or later
- iOS 15.0+ deployment target
- Swift 5.9+

### Configuration

1. Open the project in Xcode
2. Set your Bundle Identifier in project settings
3. Configure environment variables in Info.plist:
   - `API_BASE_URL`: Backend API URL (e.g., `http://localhost:8003`)
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Dependencies

The app uses Swift Package Manager. Dependencies will be added when creating the Xcode project:
- SwiftUI (built-in)
- Combine (built-in)
- AVFoundation (built-in)
- PhotosUI (built-in)

### Running the App

1. Select your target device or simulator
2. Build and run (⌘R)
3. The app will launch and show the login screen

## API Integration

The app communicates with:
- **Backend API**: `/api/mobile/*` endpoints for mobile-specific operations
- **AI Service**: `/api/ai/detect-defects` for defect detection
- **Browser Automation**: `/api/ai/automate-panel-population` for panel layout updates

## Architecture

- **MVVM Pattern**: Views observe ViewModels/ObservableObjects
- **Service Layer**: Centralized API communication
- **Keychain Storage**: Secure token storage
- **Async/Await**: Modern Swift concurrency

## Next Steps

1. Create Xcode project file (.xcodeproj)
2. Add Swift Package dependencies
3. Configure build settings
4. Test on device/simulator

