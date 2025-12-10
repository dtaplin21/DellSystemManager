# API Specifications

## Overview

This document describes all API endpoints, request/response formats, and integration specifications for the form extraction system.

## API Architecture

### Base URLs
- **Backend API**: `https://geosyntec-backend.onrender.com`
- **AI Service**: `https://quality-control-quality-assurance.onrender.com` (or `AI_SERVICE_URL` env var)

### Authentication
- **Method**: JWT Bearer Token
- **Header**: `Authorization: Bearer <token>`
- **Token Format**: JWT (JSON Web Token)

## Endpoint 1: Form Field Extraction

### Endpoint
```
POST /api/mobile/extract-form-data/:projectId
```

### Description
Extracts form fields from an uploaded image. Routes to AI service for as-built forms or legacy extractor for defect reports.

### Path Parameters
- `projectId` (string, required): UUID of the project

### Request Body
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `image` (file, required): Image file (JPEG/PNG)
  - `formType` (string, optional): Form type enum value

### Form Type Values
- `panel_placement`
- `panel_seaming`
- `non_destructive`
- `trial_weld`
- `repairs`
- `destructive`

### Request Headers
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

### Response Format

#### Success Response (200 OK)
```json
{
  "success": true,
  "extracted_fields": {
    "fieldName": "value" | null,
    ...
  },
  "confidence": 0.85,
  "message": "Form fields extracted successfully",
  "form_type": "repairs"
}
```

#### Error Response (200 OK - Graceful Failure)
```json
{
  "success": false,
  "extracted_fields": {},
  "confidence": 0,
  "message": "Could not extract form data from image. Please enter manually.",
  "form_type": "repairs"
}
```

#### Service Unavailable (503)
```json
{
  "success": false,
  "message": "AI extraction service is not available. OPENAI_API_KEY not configured.",
  "extracted_fields": {},
  "confidence": 0
}
```

### Routing Logic
- If `formType` is in as-built form types → Route to AI Service
- Otherwise → Route to Legacy FormFieldExtractor

### Implementation
- **File**: `backend/routes/mobile.js`
- **Lines**: 150-260
- **Method**: POST handler with multipart upload

## Endpoint 2: AI Service Form Extraction

### Endpoint
```
POST /api/ai/extract-asbuilt-fields
```

### Description
AI service endpoint for extracting as-built form fields from images using GPT-4o vision model.

### Request Body
```json
{
  "image_base64": "base64_encoded_image_string",
  "form_type": "repairs",
  "project_id": "uuid_string" // optional
}
```

### Request Headers
```
Content-Type: application/json
```

### Response Format

#### Success Response (200 OK)
```json
{
  "success": true,
  "form_type": "repairs",
  "extracted_fields": {
    "date": "2024-12-08" | null,
    "repairId": "R-2" | null,
    "panelNumbers": "string" | null,
    ...
  }
}
```

#### Error Response (500)
```json
{
  "error": "Error message description"
}
```

### AI Model Configuration
- **Model**: `gpt-4o`
- **Temperature**: 0 (deterministic)
- **Max Tokens**: 2000
- **Response Format**: JSON object
- **Timeout**: 120 seconds

### Implementation
- **File**: `ai_service/app.py`
- **Endpoint**: `/api/ai/extract-asbuilt-fields`
- **Service**: `ai_service/openai_service.py`

## Endpoint 3: Form Upload

### Endpoint
```
POST /api/mobile/upload-asbuilt/:projectId
```

### Description
Uploads completed as-built form data to the backend.

### Path Parameters
- `projectId` (string, required): UUID of the project

### Request Body
```json
{
  "formType": "repairs",
  "formData": {
    "date": "2024-12-08",
    "repairId": "R-2",
    "panelNumbers": "P-123, P-124",
    ...
  },
  "imageUrl": "url_to_image" // optional
}
```

### Request Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Response Format

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Form uploaded successfully",
  "formId": "uuid_string"
}
```

#### Error Response (400/500)
```json
{
  "success": false,
  "error": "Error message description"
}
```

## Data Models

### ExtractedAsbuiltFormFields

#### Common Fields
```typescript
{
  dateTime?: string;        // ISO 8601 format
  date?: string;            // YYYY-MM-DD
  panelNumber?: string;
  panelNumbers?: string;
  locationNote?: string;
  weatherComments?: string;
  notes?: string;
  comments?: string;
}
```

#### Seaming Fields
```typescript
{
  seamLength?: number;
  seamerInitials?: string;
  machineNumber?: string;
  wedgeTemp?: number;
  nipRollerSpeed?: string;
  barrelTemp?: number;
  preheatTemp?: number;
  trackPeelInside?: number;
  trackPeelOutside?: number;
  tensileLbsPerIn?: number;
  tensileRate?: string;
  vboxPassFail?: "Pass" | "Fail" | "N/A";
}
```

#### Repair Fields
```typescript
{
  date?: string;                    // YYYY-MM-DD
  repairId?: string;                // R-{number} format
  panelNumbers?: string;
  extruderNumber?: string;
  operatorInitials?: string;
  typeDetailLocation?: string;
  vboxPassFail?: "Pass" | "Fail";
}
```

#### Testing Fields
```typescript
{
  sampleId?: string;                // D-{number} format
  testerInitials?: string;
  operatorInitials?: string;
  passFail?: "Pass" | "Fail";
  ambientTemp?: number;
}
```

## Request/Response Examples

### Example 1: Repair Form Extraction

#### Request
```http
POST /api/mobile/extract-form-data/69fc302b-166d-4543-9990-89c4b1e0ed59
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: multipart/form-data

image: [binary image data]
formType: repairs
```

#### Response
```json
{
  "success": true,
  "extracted_fields": {
    "date": "2024-12-08",
    "repairId": "R-2",
    "panelNumbers": "P-123, P-124",
    "extruderNumber": "EXT-5",
    "operatorInitials": "JD",
    "typeDetailLocation": "Seam repair at north corner",
    "vboxPassFail": "Pass"
  },
  "confidence": 0.85,
  "message": "Form fields extracted successfully",
  "form_type": "repairs"
}
```

### Example 2: Panel Seaming Form Extraction

#### Request
```http
POST /api/mobile/extract-form-data/69fc302b-166d-4543-9990-89c4b1e0ed59
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: multipart/form-data

image: [binary image data]
formType: panel_seaming
```

#### Response
```json
{
  "success": true,
  "extracted_fields": {
    "dateTime": "2024-12-08T14:30",
    "panelNumbers": "P-123, P-124",
    "seamLength": 150.5,
    "seamerInitials": "JD",
    "machineNumber": "M-5",
    "wedgeTemp": 450,
    "nipRollerSpeed": "2.5",
    "barrelTemp": 420,
    "preheatTemp": 400,
    "trackPeelInside": 25.5,
    "trackPeelOutside": 26.0,
    "tensileLbsPerIn": 45.2,
    "tensileRate": "2.0",
    "vboxPassFail": "Pass",
    "weatherComments": "Clear, 65°F"
  },
  "confidence": 0.85,
  "message": "Form fields extracted successfully",
  "form_type": "panel_seaming"
}
```

## Error Handling

### Error Types

#### Network Errors
- **Status**: Network failure
- **Handling**: Retry once, then manual entry
- **User Message**: "Network error. Please check connection."

#### AI Service Errors
- **Status**: 500 or timeout
- **Handling**: Return empty fields, allow manual entry
- **User Message**: "Could not extract form data. Please enter manually."

#### Validation Errors
- **Status**: 200 (success with null fields)
- **Handling**: Invalid fields set to null
- **User Message**: Field-level validation errors

#### Authentication Errors
- **Status**: 401 Unauthorized
- **Handling**: Redirect to login
- **User Message**: "Please log in to continue."

## Timeout Configuration

### Backend → AI Service
- **Timeout**: 120 seconds (2 minutes)
- **Reason**: Vision model processing can take time

### Mobile → Backend
- **Timeout**: 180 seconds (3 minutes)
- **Reason**: Includes image upload and processing

## Rate Limiting

### Current Implementation
- No rate limiting currently implemented
- OpenAI API has its own rate limits

### Recommended Limits
- **Per User**: 10 requests per minute
- **Per Project**: 50 requests per minute
- **Global**: 1000 requests per minute

## Security Considerations

### Authentication
- JWT token required for all endpoints
- Token validated on each request
- Token expiration handled

### Data Privacy
- Images processed server-side
- Images not stored permanently
- Form data encrypted in transit (HTTPS)

### API Keys
- OpenAI API key stored as environment variable
- Not exposed in API responses
- Rotated regularly

## Integration Guide

### Mobile App Integration

#### Swift Implementation
```swift
let endpoint = "/api/mobile/extract-form-data/\(projectId)"
let additionalFields = ["formType": formType]
let data = try await apiClient.uploadMultipart(
    endpoint: endpoint,
    imageData: compressedImageData,
    imageName: "extract_\(UUID().uuidString).jpg",
    additionalFields: additionalFields
)
```

#### Response Decoding
```swift
let decoder = JSONDecoder()
let response = try decoder.decode(AsbuiltFormExtractionResponse.self, from: data)
```

### Backend Integration

#### Node.js Implementation
```javascript
router.post('/extract-form-data/:projectId', auth, upload.single('image'), async (req, res) => {
  const { formType } = req.body;
  const imageBase64 = req.file.buffer.toString('base64');
  
  if (asbuiltFormTypes.includes(formType)) {
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/ai/extract-asbuilt-fields`,
      { image_base64: imageBase64, form_type: formType }
    );
    return res.json({ success: true, extracted_fields: aiResponse.data.extracted_fields });
  }
});
```

## API Versioning

### Current Version
- **Version**: v1 (implicit)
- **Format**: No version prefix in URLs

### Future Versioning
- **Proposed**: `/api/v1/...`, `/api/v2/...`
- **Backward Compatibility**: Maintain v1 for 6 months after v2 release

## Documentation Standards

### OpenAPI/Swagger
- Not currently implemented
- Recommended for future: OpenAPI 3.0 specification

### Postman Collection
- Not currently available
- Recommended for testing: Postman collection with examples

