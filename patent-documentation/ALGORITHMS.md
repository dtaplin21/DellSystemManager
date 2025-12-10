# Algorithms

## Overview

This document describes the core algorithms used in the form field extraction system, including validation, normalization, and post-processing logic.

## Algorithm 1: Form-Type-Specific Prompt Selection

### Purpose
Select the appropriate extraction prompt based on the form type.

### Pseudocode
```
FUNCTION selectPrompt(formType: String) -> String:
    formPrompts = {
        'panel_placement': panelPlacementPrompt,
        'panel_seaming': panelSeamingPrompt,
        'non_destructive': nonDestructivePrompt,
        'trial_weld': trialWeldPrompt,
        'repairs': repairsPrompt,
        'destructive': destructivePrompt
    }
    
    IF formType IN formPrompts:
        RETURN formPrompts[formType]
    ELSE:
        RETURN formPrompts['panel_placement']  // Default
END FUNCTION
```

### Implementation
- **Location**: `ai_service/openai_service.py`, lines 319-519
- **Complexity**: O(1) - Constant time lookup
- **Input**: Form type string (6 possible values)
- **Output**: Form-type-specific prompt string

## Algorithm 2: Repair ID Validation and Normalization

### Purpose
Validate and normalize repair IDs to match the R-{number} format.

### Pseudocode
```
FUNCTION validateAndNormalizeRepairID(repairId: String) -> String | null:
    IF repairId IS NULL OR EMPTY:
        RETURN null
    
    repairId = TRIM(repairId)
    
    // Check if already in correct format
    IF MATCHES(repairId, "^R-\\d+$", CASE_INSENSITIVE):
        RETURN UPPERCASE(repairId)
    
    // Attempt normalization
    normalized = REMOVE_ALL_CHARS_EXCEPT(repairId, "Rr0-9-")
    
    IF MATCHES(normalized, "^[Rr]-\\d+$", CASE_INSENSITIVE):
        normalized = UPPERCASE(normalized)
        LOG("Normalized repair ID: '{repairId}' -> '{normalized}'")
        RETURN normalized
    
    // Invalid format
    LOG_WARNING("Repair ID '{repairId}' does not match R-{number} format")
    RETURN null
END FUNCTION
```

### Implementation
- **Location**: `ai_service/openai_service.py`, lines 559-572
- **Complexity**: O(n) where n is length of repairId
- **Regex Patterns**:
  - Validation: `^R-\d+$` (case-insensitive)
  - Normalization: `^[Rr]-\d+$` (case-insensitive)
  - Character removal: `[^Rr0-9-]`

### Examples
- Input: "R-2" → Output: "R-2"
- Input: "R - 5" → Output: "R-5" (spaces removed)
- Input: "r-10" → Output: "R-10" (case normalized)
- Input: "2" → Output: null (missing prefix)
- Input: "R2" → Output: null (missing hyphen)
- Input: "Repair 2" → Output: null (invalid format)

## Algorithm 3: Sample ID Validation and Normalization

### Purpose
Validate and normalize sample IDs to match the D-{number} format.

### Pseudocode
```
FUNCTION validateAndNormalizeSampleID(sampleId: String) -> String | null:
    IF sampleId IS NULL OR EMPTY:
        RETURN null
    
    sampleId = TRIM(sampleId)
    
    // Check if already in correct format
    IF MATCHES(sampleId, "^D-\\d+$", CASE_INSENSITIVE):
        RETURN UPPERCASE(sampleId)
    
    // Attempt normalization
    normalized = REMOVE_ALL_CHARS_EXCEPT(sampleId, "Dd0-9-")
    
    IF MATCHES(normalized, "^[Dd]-\\d+$", CASE_INSENSITIVE):
        normalized = UPPERCASE(normalized)
        LOG("Normalized sample ID: '{sampleId}' -> '{normalized}'")
        RETURN normalized
    
    // Invalid format
    LOG_WARNING("Sample ID '{sampleId}' does not match D-{number} format")
    RETURN null
END FUNCTION
```

### Implementation
- **Location**: `ai_service/openai_service.py`, lines 574-587
- **Complexity**: O(n) where n is length of sampleId
- **Regex Patterns**:
  - Validation: `^D-\d+$` (case-insensitive)
  - Normalization: `^[Dd]-\d+$` (case-insensitive)
  - Character removal: `[^Dd0-9-]`

### Examples
- Input: "D-5" → Output: "D-5"
- Input: "D - 3" → Output: "D-3" (spaces removed)
- Input: "d-7" → Output: "D-7" (case normalized)
- Input: "5" → Output: null (missing prefix)
- Input: "D5" → Output: null (missing hyphen)
- Input: "Sample 5" → Output: null (invalid format)

## Algorithm 4: Post-Processing Validation Pipeline

### Purpose
Apply validation and normalization to all extracted fields.

### Pseudocode
```
FUNCTION postProcessExtractedFields(resultJson: Dictionary) -> Dictionary:
    // Validate repair IDs
    IF 'repairId' IN resultJson:
        resultJson['repairId'] = validateAndNormalizeRepairID(
            resultJson['repairId']
        )
    
    // Validate sample IDs
    IF 'sampleId' IN resultJson:
        resultJson['sampleId'] = validateAndNormalizeSampleID(
            resultJson['sampleId']
        )
    
    RETURN resultJson
END FUNCTION
```

### Implementation
- **Location**: `ai_service/openai_service.py`, lines 556-589
- **Complexity**: O(n) where n is number of ID fields
- **Execution**: Runs after AI extraction, before returning results

## Algorithm 5: Form Field Mapping

### Purpose
Map extracted fields to form data dictionary based on form type.

### Pseudocode
```
FUNCTION populateFormFromExtraction(
    extracted: ExtractedAsbuiltFormFields,
    formType: AsbuiltFormType
) -> Dictionary:
    formData = {}
    
    SWITCH formType:
        CASE panelPlacement:
            IF extracted.dateTime: formData['dateTime'] = extracted.dateTime
            IF extracted.panelNumber: formData['panelNumber'] = extracted.panelNumber
            IF extracted.locationNote: formData['locationNote'] = extracted.locationNote
            IF extracted.weatherComments: formData['weatherComments'] = extracted.weatherComments
        
        CASE panelSeaming:
            IF extracted.dateTime: formData['dateTime'] = extracted.dateTime
            IF extracted.panelNumbers: formData['panelNumbers'] = extracted.panelNumbers
            IF extracted.seamLength: formData['seamLength'] = extracted.seamLength
            // ... (additional fields)
        
        CASE repairs:
            IF extracted.date: formData['date'] = extracted.date
            IF extracted.repairId: formData['repairId'] = extracted.repairId
            IF extracted.panelNumbers: formData['panelNumbers'] = extracted.panelNumbers
            // ... (additional fields)
        
        // ... (other form types)
    END SWITCH
    
    RETURN formData
END FUNCTION
```

### Implementation
- **Location**: `QC APP/Views/AsbuiltFormView.swift`, lines 294-353
- **Complexity**: O(f) where f is number of fields per form type
- **Execution**: Runs after extraction completes, before form display

## Algorithm 6: JSON Extraction Fallback

### Purpose
Extract JSON from malformed AI responses using regex.

### Pseudocode
```
FUNCTION extractJSONFromText(text: String) -> Dictionary:
    // Try standard JSON parsing first
    TRY:
        RETURN JSON.parse(text)
    CATCH JSONDecodeError:
        // Attempt regex extraction
        match = REGEX_SEARCH(text, "\\{[\\s\\S]*\\}")
        IF match:
            TRY:
                RETURN JSON.parse(match.group(0))
            CATCH:
                RETURN {}
        ELSE:
            RETURN {}
END FUNCTION
```

### Implementation
- **Location**: `ai_service/openai_service.py`, lines 590-601
- **Complexity**: O(n) where n is length of text
- **Regex Pattern**: `\{[\s\S]*\}` (matches JSON object)

## Algorithm 7: Form Type Routing

### Purpose
Route extraction requests to appropriate service based on form type.

### Pseudocode
```
FUNCTION routeExtractionRequest(formType: String) -> Service:
    asbuiltFormTypes = [
        'panel_placement',
        'panel_seaming',
        'non_destructive',
        'trial_weld',
        'repairs',
        'destructive'
    ]
    
    IF formType IN asbuiltFormTypes:
        RETURN AIService
    ELSE:
        RETURN LegacyFormFieldExtractor
END FUNCTION
```

### Implementation
- **Location**: `backend/routes/mobile.js`, lines 156-164
- **Complexity**: O(1) - Constant time lookup
- **Execution**: Runs on each extraction request

## Algorithm Complexity Summary

| Algorithm | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Prompt Selection | O(1) | O(1) |
| Repair ID Validation | O(n) | O(1) |
| Sample ID Validation | O(n) | O(1) |
| Post-Processing | O(k) | O(1) |
| Field Mapping | O(f) | O(f) |
| JSON Extraction | O(n) | O(n) |
| Form Type Routing | O(1) | O(1) |

Where:
- n = length of string
- k = number of ID fields
- f = number of form fields

## Error Handling

All algorithms include error handling:
- **Null/Empty Input**: Returns null or empty dictionary
- **Invalid Format**: Logs warning, returns null
- **JSON Parse Errors**: Attempts regex extraction, falls back to empty dict
- **Network Errors**: Returns error message, allows manual entry

