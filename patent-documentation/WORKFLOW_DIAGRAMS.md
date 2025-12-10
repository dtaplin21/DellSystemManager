# Workflow Diagrams

## Overview

This document describes the complete workflows for form field extraction, validation, and form population.

## Workflow 1: Complete Form Extraction Flow

```
┌─────────────┐
│   User      │
│  Opens Form │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  Mobile App             │
│  - Image captured       │
│  - Form type selected   │
└──────┬──────────────────┘
       │
       │ POST /api/mobile/extract-form-data/:projectId
       │ { image, formType }
       ▼
┌─────────────────────────┐
│  Backend API            │
│  - Receives image       │
│  - Detects form type    │
│  - Routes to AI service │
└──────┬──────────────────┘
       │
       │ POST /api/ai/extract-asbuilt-fields
       │ { image_base64, form_type }
       ▼
┌─────────────────────────┐
│  AI Service             │
│  - Selects prompt       │
│  - Calls GPT-4o         │
│  - Validates response   │
└──────┬──────────────────┘
       │
       │ API Call
       ▼
┌─────────────────────────┐
│  OpenAI GPT-4o          │
│  - Analyzes image       │
│  - Extracts fields      │
│  - Returns JSON         │
└──────┬──────────────────┘
       │
       │ JSON Response
       ▼
┌─────────────────────────┐
│  AI Service             │
│  - Post-processes       │
│  - Normalizes IDs       │
│  - Validates format     │
└──────┬──────────────────┘
       │
       │ { extracted_fields }
       ▼
┌─────────────────────────┐
│  Backend API            │
│  - Formats response     │
│  - Returns to mobile    │
└──────┬──────────────────┘
       │
       │ JSON Response
       ▼
┌─────────────────────────┐
│  Mobile App             │
│  - Decodes response     │
│  - Maps to form fields  │
│  - Populates form       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│   User                  │
│  - Reviews data         │
│  - Edits if needed      │
│  - Submits form         │
└─────────────────────────┘
```

## Workflow 2: Form Type Routing

```
┌─────────────────────┐
│  Extraction Request │
│  { formType }       │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ Check Form   │
    │ Type         │
    └──────┬───────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐  ┌──────────────┐
│ As-built│  │ Defect Report│
│ Forms   │  │ or Other     │
└────┬────┘  └──────┬───────┘
     │              │
     │              │
     ▼              ▼
┌──────────┐  ┌──────────────┐
│ AI       │  │ Legacy       │
│ Service  │  │ Extractor    │
└──────────┘  └──────────────┘
```

## Workflow 3: ID Validation and Normalization

```
┌─────────────────┐
│ Extracted Data  │
│ { repairId }    │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ Check if repairId     │
│ exists and not null   │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Match pattern         │
│ ^R-\\d+$             │
└────────┬─────────────┘
         │
    ┌────┴────┐
    │         │
    YES       NO
    │         │
    │         ▼
    │    ┌──────────────────┐
    │    │ Normalize:        │
    │    │ Remove non-alnum  │
    │    │ Check pattern     │
    │    └────────┬─────────┘
    │             │
    │        ┌────┴────┐
    │        │         │
    │       YES       NO
    │        │         │
    │        │         ▼
    │        │    ┌──────────┐
    │        │    │ Set null │
    │        │    └──────────┘
    │        │
    └────────┴────────┐
                     │
                     ▼
            ┌────────────────┐
            │ Return          │
            │ normalized ID   │
            └─────────────────┘
```

## Workflow 4: Form Population

```
┌─────────────────────┐
│ Extracted Fields    │
│ { field1, field2 } │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check Form Type     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐  ┌─────────┐
│ Repairs │  │ Seaming │
│ etc.    │  │ etc.    │
└────┬────┘  └────┬────┘
     │            │
     │            │
     └─────┬──────┘
           │
           ▼
┌─────────────────────┐
│ Map Fields by Type  │
│ - date → formData   │
│ - repairId → ...   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Form Data Dictionary│
│ { key: value }      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Update SwiftUI      │
│ Form Fields         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ User Sees           │
│ Populated Form      │
└─────────────────────┘
```

## Workflow 5: Error Handling Flow

```
┌─────────────────────┐
│ Extraction Request  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Try Extraction      │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    Success      Error
    │             │
    │      ┌──────┴──────┐
    │      │             │
    │   Network      AI Service
    │   Error        Error
    │      │             │
    │      └──────┬──────┘
    │             │
    │             ▼
    │      ┌─────────────────┐
    │      │ Log Error       │
    │      │ Return Empty    │
    │      │ Fields          │
    │      └────────┬────────┘
    │               │
    └───────────────┘
           │
           ▼
┌─────────────────────┐
│ Mobile App          │
│ - Shows Error       │
│ - Allows Manual     │
│   Entry             │
└─────────────────────┘
```

## Workflow 6: Pre-Upload Auto-Fill Workflow

```
┌─────────────────────┐
│ User Captures Image │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Form Opens          │
│ - Image displayed   │
│ - Form type shown   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ onAppear Triggered  │
│ - Extraction starts │
│ - Form disabled     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Loading Indicator   │
│ "AI Analyzing..."   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Extraction Completes│
│ - Fields populated  │
│ - Form enabled      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ User Reviews        │
│ - Checks data       │
│ - Edits if needed   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ User Submits        │
│ - Form uploaded     │
└─────────────────────┘
```

## Workflow 7: State Management Flow

```
┌─────────────────────┐
│ Initial State       │
│ - isExtracting: false│
│ - extractionAttempted: false│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ onAppear            │
│ - Set isExtracting: true│
│ - Set extractionAttempted: true│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Extraction Running  │
│ - Form disabled     │
│ - Loading shown     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    Success      Error
    │             │
    │      ┌──────┴──────┐
    │      │             │
    │   Set error    Set error
    │   message      message
    │      │             │
    │      └──────┬──────┘
    │             │
    └─────────────┘
           │
           ▼
┌─────────────────────┐
│ Set isExtracting:   │
│ false               │
│ - Form enabled      │
│ - Data populated    │
└─────────────────────┘
```

## Sequence Diagram: Complete Extraction

```
User    Mobile App    Backend API    AI Service    OpenAI
 │           │            │              │           │
 │           │            │              │           │
 │──Capture──>│            │              │           │
 │           │            │              │           │
 │──Select───>│            │              │           │
 │  Form Type│            │              │           │
 │           │            │              │           │
 │           │──POST──────>│              │           │
 │           │  Image     │              │           │
 │           │  FormType   │              │           │
 │           │            │              │           │
 │           │            │──POST───────>│           │
 │           │            │  Image       │           │
 │           │            │  FormType    │           │
 │           │            │              │           │
 │           │            │              │──API─────>│
 │           │            │              │  Call     │
 │           │            │              │           │
 │           │            │              │<──JSON────│
 │           │            │              │  Response │
 │           │            │              │           │
 │           │            │              │──Validate─│
 │           │            │              │  & Normalize│
 │           │            │              │           │
 │           │            │<──JSON────────│           │
 │           │            │  Extracted    │           │
 │           │            │  Fields      │           │
 │           │            │              │           │
 │           │<──JSON─────│              │           │
 │           │  Response  │              │           │
 │           │            │              │           │
 │           │──Populate──│              │           │
 │           │  Form      │              │           │
 │           │            │              │           │
 │<──Display──│            │              │           │
 │  Form      │            │              │           │
 │           │            │              │           │
```

## Decision Points

### Decision 1: Form Type Routing
- **Condition**: `formType in asbuiltFormTypes`
- **True**: Route to AI Service
- **False**: Route to Legacy Extractor

### Decision 2: ID Format Validation
- **Condition**: `repairId matches ^R-\\d+$`
- **True**: Use as-is
- **False**: Attempt normalization

### Decision 3: Normalization Success
- **Condition**: `normalized matches ^[Rr]-\\d+$`
- **True**: Use normalized value
- **False**: Set to null

### Decision 4: Extraction Success
- **Condition**: `response.success == true`
- **True**: Populate form
- **False**: Show error, allow manual entry

## Timing Characteristics

- **Image Capture**: < 1 second
- **Image Compression**: < 1 second
- **Network Upload**: 1-3 seconds
- **Backend Routing**: < 0.1 seconds
- **AI Service Call**: 2-10 seconds
- **Post-Processing**: < 0.1 seconds
- **Response Return**: 1-3 seconds
- **Form Population**: < 0.1 seconds
- **Total Time**: 5-18 seconds

## Error Recovery

1. **Network Error**: Retry once, then manual entry
2. **AI Service Error**: Return empty fields, manual entry
3. **Validation Error**: Set invalid fields to null, user corrects
4. **Timeout**: Return error message, manual entry
5. **JSON Parse Error**: Attempt regex extraction, fallback to empty

