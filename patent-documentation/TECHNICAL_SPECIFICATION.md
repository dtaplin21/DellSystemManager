# Technical Specification

## System Overview

The system is an AI-powered form field extraction and auto-population system specifically designed for geosynthetic quality control (QC) as-built forms. It uses vision-language models to extract structured data from form images and automatically populate digital forms with validation and normalization.

## Core Technology Stack

### AI/ML Components
- **Vision-Language Model**: OpenAI GPT-4o (multimodal)
- **Model Type**: Transformer-based neural network
- **Input Format**: Base64-encoded images
- **Output Format**: Structured JSON

### Backend Components
- **Runtime**: Node.js (Express.js)
- **AI Service**: Python (Flask)
- **Communication**: RESTful API (HTTP/JSON)
- **Image Processing**: Base64 encoding/decoding

### Mobile Components
- **Platform**: iOS (SwiftUI)
- **Image Capture**: Camera integration
- **Form Rendering**: Dynamic form generation
- **State Management**: Swift @State, @Binding

## System Components

### 1. Mobile Application (iOS)
- **File**: `QC APP/Views/AsbuiltFormView.swift`
- **Purpose**: User interface for form capture and display
- **Key Features**:
  - Image capture and preview
  - Form type selection (6 types)
  - Real-time form field extraction
  - Form auto-population
  - Form validation
  - Upload functionality

### 2. Backend API (Node.js)
- **File**: `backend/routes/mobile.js`
- **Purpose**: API gateway and routing
- **Key Features**:
  - Form type detection and routing
  - Image upload handling
  - AI service integration
  - Response formatting
  - Error handling

### 3. AI Service (Python)
- **File**: `ai_service/openai_service.py`
- **Purpose**: AI-powered form field extraction
- **Key Features**:
  - Form-type-specific prompt selection
  - Vision model integration (GPT-4o)
  - Post-processing validation
  - Format normalization

## Form Types Supported

1. **Panel Placement** (`panel_placement`)
   - Fields: dateTime, panelNumber, locationNote, weatherComments

2. **Panel Seaming** (`panel_seaming`)
   - Fields: dateTime, panelNumbers, seamLength, seamerInitials, machineNumber, wedgeTemp, nipRollerSpeed, barrelTemp, preheatTemp, trackPeelInside, trackPeelOutside, tensileLbsPerIn, tensileRate, vboxPassFail, weatherComments

3. **Non-Destructive Testing** (`non_destructive`)
   - Fields: dateTime, panelNumbers, operatorInitials, vboxPassFail, notes

4. **Trial Weld** (`trial_weld`)
   - Fields: dateTime, seamerInitials, machineNumber, wedgeTemp, nipRollerSpeed, barrelTemp, preheatTemp, trackPeelInside, trackPeelOutside, tensileLbsPerIn, tensileRate, passFail, ambientTemp, comments

5. **Repairs** (`repairs`)
   - Fields: date, repairId (R-{number} format), panelNumbers, extruderNumber, operatorInitials, typeDetailLocation, vboxPassFail

6. **Destructive Testing** (`destructive`)
   - Fields: date, panelNumbers, sampleId (D-{number} format), testerInitials, machineNumber, trackPeelInside, trackPeelOutside, tensileLbsPerIn, tensileRate, passFail, comments

## Technical Process Flow

1. **Image Capture**: User captures form image via mobile app
2. **Image Encoding**: Image compressed and base64-encoded
3. **Form Type Selection**: User selects form type (or auto-detected)
4. **API Request**: Mobile app sends image + formType to backend
5. **Backend Routing**: Backend routes to appropriate extraction service
6. **AI Extraction**: AI service uses form-type-specific prompt
7. **Validation**: Post-processing validates and normalizes extracted data
8. **Response**: Structured JSON returned to mobile app
9. **Form Population**: Mobile app auto-populates form fields
10. **User Review**: User reviews and edits extracted data
11. **Upload**: User submits completed form

## Data Formats

### Input Format
- **Image**: JPEG/PNG, base64-encoded
- **Form Type**: String enum (6 types)
- **Project ID**: UUID string

### Output Format
- **JSON Structure**: 
  ```json
  {
    "success": boolean,
    "extracted_fields": {
      "fieldName": value | null
    },
    "confidence": number (0-1),
    "message": string,
    "form_type": string
  }
  ```

### Field Value Types
- **Strings**: Text fields, IDs, initials
- **Numbers**: Temperatures, measurements, lengths
- **Dates**: ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm)
- **Enums**: "Pass", "Fail", "N/A"

## Validation Rules

### Format-Specific Validation
- **Repair IDs**: Must match pattern `R-{number}` (e.g., "R-2", "R-15")
- **Sample IDs**: Must match pattern `D-{number}` (e.g., "D-5", "D-12")
- **Normalization**: Handles variations (spaces, case) and normalizes to standard format
- **Rejection**: Invalid formats are set to null

### Data Type Validation
- **Numbers**: Must be valid numeric values
- **Dates**: Must be valid ISO 8601 format
- **Enums**: Must match allowed values

## Performance Characteristics

- **Extraction Time**: 2-10 seconds (depending on image complexity)
- **API Timeout**: 120 seconds (2 minutes)
- **Image Size**: Compressed to ~700KB average
- **Response Size**: ~200-500 bytes JSON
- **Confidence Score**: 0.85 default for AI extraction

## Error Handling

- **Network Errors**: Graceful degradation, manual entry fallback
- **AI Service Errors**: Returns empty fields, allows manual entry
- **Validation Errors**: Invalid data set to null, user can correct
- **Timeout Handling**: 2-minute timeout with error message

## Security Considerations

- **Authentication**: JWT token-based authentication
- **Image Privacy**: Images processed server-side, not stored permanently
- **Data Validation**: Server-side validation prevents injection
- **API Security**: HTTPS required, authenticated endpoints

