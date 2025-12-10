# System Architecture

## Architecture Overview

The system follows a three-tier architecture:
1. **Mobile Client** (iOS SwiftUI)
2. **Backend API** (Node.js/Express)
3. **AI Service** (Python/Flask)

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Application (iOS)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Image Capture│  │ Form Display │  │ Form Upload  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                  │              │
│         └─────────────────┼──────────────────┘              │
│                           │                                  │
│                  ┌────────▼────────┐                        │
│                  │ FormExtraction  │                        │
│                  │    Service      │                        │
│                  └────────┬────────┘                        │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTP/HTTPS
                            │ JSON
┌───────────────────────────▼──────────────────────────────────┐
│              Backend API (Node.js/Express)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         /api/mobile/extract-form-data/:projectId     │   │
│  │                                                       │   │
│  │  • Image Upload Handling                            │   │
│  │  • Form Type Detection                               │   │
│  │  • Routing Logic                                     │   │
│  │  • Response Formatting                               │   │
│  └───────────────────┬───────────────────────────────────┘   │
│                      │                                        │
│         ┌────────────┴────────────┐                         │
│         │                         │                          │
│  ┌──────▼──────┐         ┌────────▼────────┐               │
│  │ As-built    │         │ Defect Report    │               │
│  │ Forms       │         │ Extractor        │               │
│  │ (AI Service)│         │ (Legacy)          │               │
│  └──────┬──────┘         └──────────────────┘               │
└─────────┼────────────────────────────────────────────────────┘
          │ HTTP/HTTPS
          │ JSON
┌─────────▼─────────────────────────────────────────────────────┐
│              AI Service (Python/Flask)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/ai/extract-asbuilt-fields                      │   │
│  │                                                       │   │
│  │  • Form-Type-Specific Prompt Selection              │   │
│  │  • GPT-4o Vision Model Integration                  │   │
│  │  • Post-Processing Validation                       │   │
│  │  • Format Normalization                             │   │
│  └───────────────────┬───────────────────────────────────┘   │
│                      │                                        │
│         ┌────────────▼────────────┐                          │
│         │   OpenAI GPT-4o API      │                          │
│         │   (Vision-Language Model)│                          │
│         └─────────────────────────┘                          │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Image Capture Flow
```
User → Camera → Image → Compression → Base64 Encoding → API Request
```

### 2. Extraction Flow
```
Mobile App
  ↓ (POST /api/mobile/extract-form-data/:projectId)
Backend API
  ↓ (Form Type Detection)
  ├─→ As-built Forms → AI Service
  └─→ Defect Reports → Legacy Extractor
  ↓ (POST /api/ai/extract-asbuilt-fields)
AI Service
  ↓ (Form-Type-Specific Prompt Selection)
  ↓ (GPT-4o Vision API Call)
OpenAI API
  ↓ (Structured JSON Response)
AI Service
  ↓ (Post-Processing Validation)
  ↓ (Format Normalization)
Backend API
  ↓ (Response Formatting)
Mobile App
  ↓ (Form Auto-Population)
User Review
```

### 3. Form Population Flow
```
Extracted JSON
  ↓
Field Mapping (by form type)
  ↓
Form Data Dictionary
  ↓
SwiftUI Form Fields
  ↓
User Review & Edit
  ↓
Form Submission
```

## Component Interactions

### Mobile App → Backend API
- **Endpoint**: `POST /api/mobile/extract-form-data/:projectId`
- **Method**: Multipart form data
- **Payload**:
  - `image`: File (JPEG/PNG)
  - `formType`: String (form type enum)
- **Headers**:
  - `Authorization`: Bearer token (JWT)
  - `Content-Type`: multipart/form-data

### Backend API → AI Service
- **Endpoint**: `POST /api/ai/extract-asbuilt-fields`
- **Method**: JSON
- **Payload**:
  - `image_base64`: String (base64-encoded image)
  - `form_type`: String (form type enum)
  - `project_id`: String (optional UUID)
- **Headers**:
  - `Content-Type`: application/json

### AI Service → OpenAI API
- **Model**: `gpt-4o`
- **Input Format**: 
  - System message (form-type-specific rules)
  - User message (extraction prompt)
  - Image (base64-encoded)
- **Output Format**: JSON object
- **Parameters**:
  - `max_tokens`: 2000
  - `temperature`: 0 (deterministic)
  - `response_format`: {"type": "json_object"}

## State Management

### Mobile App State
- `isExtracting`: Boolean (extraction in progress)
- `extractionError`: String? (error message)
- `extractionAttempted`: Boolean (extraction attempted)
- `formData`: Dictionary (form field values)
- `validationErrors`: Dictionary (field validation errors)

### Backend State
- Stateless (RESTful)
- Session-based authentication (JWT tokens)
- No persistent state between requests

### AI Service State
- Stateless (RESTful)
- No persistent state between requests

## Routing Logic

### Form Type Detection
```javascript
if (formType && asbuiltFormTypes.includes(formType)) {
  // Route to AI Service
  → POST /api/ai/extract-asbuilt-fields
} else {
  // Route to Legacy Extractor
  → FormFieldExtractor.extractFormFields()
}
```

### As-Built Form Types
- `panel_placement`
- `panel_seaming`
- `non_destructive`
- `trial_weld`
- `repairs`
- `destructive`

## Error Handling Architecture

### Mobile App Error Handling
- Network errors → Display error message, allow manual entry
- Decoding errors → Log details, fallback to empty form
- Validation errors → Display field-level errors

### Backend Error Handling
- AI service errors → Return empty fields, 200 status
- Timeout errors → Return error message, 200 status
- Authentication errors → Return 401 status

### AI Service Error Handling
- OpenAI API errors → Log error, return empty dict
- JSON decode errors → Attempt regex extraction, fallback to empty dict
- Validation errors → Set invalid fields to null

## Scalability Considerations

### Horizontal Scaling
- Backend API: Stateless, can scale horizontally
- AI Service: Stateless, can scale horizontally
- Load balancing: Can use standard load balancers

### Vertical Scaling
- AI Service: GPU-accelerated inference (if using local models)
- Backend API: CPU/memory scaling for concurrent requests

### Caching Strategy
- No caching currently implemented
- Potential: Cache form-type-specific prompts
- Potential: Cache common extraction patterns

## Security Architecture

### Authentication Flow
```
User Login → JWT Token → Token in API Requests → Backend Validation
```

### Data Privacy
- Images: Processed server-side, not stored permanently
- Form Data: Encrypted in transit (HTTPS)
- API Keys: Stored as environment variables

### API Security
- JWT token validation on all endpoints
- HTTPS required for all communications
- CORS configured for mobile app domain

