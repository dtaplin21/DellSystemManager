# Validation Rules

## Overview

This document describes all validation rules applied to extracted form data, including format-specific rules, data type validation, and normalization procedures.

## Format-Specific Validation Rules

### Rule 1: Repair ID Format (R-{number})

#### Pattern
- **Required Format**: `R-{number}`
- **Regex Pattern**: `^R-\d+$`
- **Case Sensitivity**: Case-insensitive matching
- **Examples**:
  - ✅ Valid: "R-2", "R-15", "R-123"
  - ❌ Invalid: "2", "R2", "Repair 2", "r2"

#### Validation Logic
```python
def validate_repair_id(repair_id: str) -> str | None:
    if not repair_id:
        return None
    
    repair_id = repair_id.strip()
    
    # Check exact match
    if re.match(r'^R-\d+$', repair_id, re.IGNORECASE):
        return repair_id.upper()
    
    # Attempt normalization
    normalized = re.sub(r'[^Rr0-9-]', '', repair_id)
    if re.match(r'^[Rr]-\d+$', normalized, re.IGNORECASE):
        return normalized.upper()
    
    # Invalid format
    return None
```

#### Normalization Rules
1. **Space Removal**: Remove all spaces
   - "R - 5" → "R-5"
   - "R - 10" → "R-10"

2. **Case Normalization**: Convert to uppercase
   - "r-2" → "R-2"
   - "R-15" → "R-15"

3. **Character Removal**: Remove all characters except R, r, digits, and hyphen
   - "R-2a" → "R-2"
   - "R-5b" → "R-5"

4. **Rejection Criteria**:
   - Missing "R-" prefix → Reject
   - Missing hyphen → Reject
   - Non-numeric suffix → Reject (after normalization)

#### Implementation Location
- **File**: `ai_service/openai_service.py`
- **Lines**: 559-572
- **Function**: Post-processing validation

### Rule 2: Sample ID Format (D-{number})

#### Pattern
- **Required Format**: `D-{number}`
- **Regex Pattern**: `^D-\d+$`
- **Case Sensitivity**: Case-insensitive matching
- **Examples**:
  - ✅ Valid: "D-5", "D-12", "D-99"
  - ❌ Invalid: "5", "D5", "Sample 5", "d5"

#### Validation Logic
```python
def validate_sample_id(sample_id: str) -> str | None:
    if not sample_id:
        return None
    
    sample_id = sample_id.strip()
    
    # Check exact match
    if re.match(r'^D-\d+$', sample_id, re.IGNORECASE):
        return sample_id.upper()
    
    # Attempt normalization
    normalized = re.sub(r'[^Dd0-9-]', '', sample_id)
    if re.match(r'^[Dd]-\d+$', normalized, re.IGNORECASE):
        return normalized.upper()
    
    # Invalid format
    return None
```

#### Normalization Rules
1. **Space Removal**: Remove all spaces
   - "D - 3" → "D-3"
   - "D - 7" → "D-7"

2. **Case Normalization**: Convert to uppercase
   - "d-5" → "D-5"
   - "D-12" → "D-12"

3. **Character Removal**: Remove all characters except D, d, digits, and hyphen
   - "D-5x" → "D-5"
   - "D-12y" → "D-12"

4. **Rejection Criteria**:
   - Missing "D-" prefix → Reject
   - Missing hyphen → Reject
   - Non-numeric suffix → Reject (after normalization)

#### Implementation Location
- **File**: `ai_service/openai_service.py`
- **Lines**: 574-587
- **Function**: Post-processing validation

## Data Type Validation Rules

### Rule 3: Date Format Validation

#### Pattern
- **Format**: ISO 8601
- **Date Only**: `YYYY-MM-DD`
- **Date-Time**: `YYYY-MM-DDTHH:mm`
- **Examples**:
  - ✅ Valid: "2024-12-08", "2024-12-08T14:30"
  - ❌ Invalid: "12/08/2024", "Dec 8, 2024"

#### Validation Logic
- Check format matches ISO 8601 pattern
- Validate date is valid (not Feb 30, etc.)
- Time must be in 24-hour format

#### Implementation
- **Location**: Client-side (Swift DateFormatter)
- **Format**: ISO 8601 standard

### Rule 4: Number Format Validation

#### Pattern
- **Type**: Numeric (integer or decimal)
- **Examples**:
  - ✅ Valid: "123", "45.67", "-10.5"
  - ❌ Invalid: "abc", "12.34.56", "12a"

#### Validation Logic
- Must be parseable as number
- Decimal points allowed
- Negative numbers allowed
- No alphabetic characters

#### Implementation
- **Location**: Client-side (Swift numeric parsing)
- **Type**: Double or Int

### Rule 5: Enum Value Validation

#### Pattern
- **Type**: Predefined string values
- **Examples**:
  - `vboxPassFail`: "Pass", "Fail", "N/A"
  - `passFail`: "Pass", "Fail"

#### Validation Logic
- Must match one of allowed values
- Case-sensitive matching
- Null allowed if field not required

#### Implementation
- **Location**: Client-side (Swift Picker)
- **Options**: Predefined array

## Field-Specific Validation Rules

### Rule 6: Required Field Validation

#### Pattern
- **Type**: Boolean flag per field
- **Logic**: Required fields must have non-null values

#### Implementation
- **Location**: `QC APP/Models/AsbuiltForm.swift`
- **Fields**: Marked with `required: true`

#### Required Fields by Form Type
- **Panel Placement**: dateTime, panelNumber
- **Panel Seaming**: dateTime, panelNumbers, seamerInitials, vboxPassFail
- **Non-Destructive**: dateTime, panelNumbers, operatorInitials, vboxPassFail
- **Trial Weld**: dateTime, seamerInitials, passFail
- **Repairs**: date, repairId, panelNumbers
- **Destructive**: date, panelNumbers, sampleId, passFail

### Rule 7: Temperature Range Validation

#### Pattern
- **Type**: Numeric range
- **Units**: Fahrenheit (°F)
- **Typical Range**: -50°F to 500°F (reasonable range)

#### Implementation
- **Location**: Client-side validation (optional)
- **Fields**: wedgeTemp, barrelTemp, preheatTemp, ambientTemp

### Rule 8: Measurement Range Validation

#### Pattern
- **Type**: Numeric range
- **Units**: Varies by field
- **Examples**:
  - `seamLength`: Feet (0-10000)
  - `trackPeelInside`: Measurement value (0-1000)
  - `tensileLbsPerIn`: Pounds per inch (0-10000)

#### Implementation
- **Location**: Client-side validation (optional)
- **Fields**: Various measurement fields

## Normalization Procedures

### Procedure 1: ID Format Normalization

#### Steps
1. **Trim**: Remove leading/trailing whitespace
2. **Character Removal**: Remove invalid characters
3. **Pattern Matching**: Check normalized pattern
4. **Case Conversion**: Convert to uppercase
5. **Validation**: Final format check

#### Example Flow
```
Input: "R - 5"
  → Trim: "R - 5"
  → Remove spaces: "R-5"
  → Pattern match: ✅
  → Uppercase: "R-5"
  → Output: "R-5"
```

### Procedure 2: Date Normalization

#### Steps
1. **Parse**: Attempt to parse input date
2. **Format**: Convert to ISO 8601 format
3. **Validate**: Check date is valid

#### Example Flow
```
Input: "12/08/2024"
  → Parse: Date object
  → Format: "2024-12-08"
  → Validate: ✅
  → Output: "2024-12-08"
```

### Procedure 3: Number Normalization

#### Steps
1. **Parse**: Convert string to number
2. **Format**: Standardize decimal places
3. **Validate**: Check within reasonable range

#### Example Flow
```
Input: "45.67000"
  → Parse: 45.67
  → Format: "45.67"
  → Validate: ✅
  → Output: 45.67
```

## Validation Pipeline

### Stage 1: AI Extraction Validation
- **Location**: AI prompt
- **Purpose**: Guide AI to extract correct formats
- **Rules**: Format examples and rejection criteria in prompt

### Stage 2: Post-Processing Validation
- **Location**: AI service (`openai_service.py`)
- **Purpose**: Validate and normalize extracted data
- **Rules**: Format-specific validation (R-{number}, D-{number})

### Stage 3: Client-Side Validation
- **Location**: Mobile app (`AsbuiltFormView.swift`)
- **Purpose**: Validate user input and extracted data
- **Rules**: Required fields, data types, ranges

### Stage 4: Server-Side Validation
- **Location**: Backend API
- **Purpose**: Final validation before storage
- **Rules**: All validation rules applied

## Error Handling

### Invalid Format Handling
- **Action**: Set field to null
- **User Impact**: User can enter value manually
- **Logging**: Warning logged with invalid value

### Missing Required Field Handling
- **Action**: Display validation error
- **User Impact**: User must enter value
- **UI**: Red error message below field

### Type Mismatch Handling
- **Action**: Attempt conversion, or set to null
- **User Impact**: User can correct value
- **Logging**: Error logged with type information

## Validation Rules Summary

| Rule | Type | Pattern | Normalization | Rejection |
|------|------|---------|--------------|-----------|
| Repair ID | Format | `^R-\d+$` | Spaces, case | Missing prefix/hyphen |
| Sample ID | Format | `^D-\d+$` | Spaces, case | Missing prefix/hyphen |
| Date | Format | ISO 8601 | Parse & format | Invalid date |
| Number | Type | Numeric | Decimal places | Non-numeric |
| Enum | Value | Predefined | Case match | Invalid value |
| Required | Presence | Non-null | N/A | Missing value |

## Implementation Details

### Regex Patterns
- Repair ID: `^R-\d+$` (validation), `^[Rr]-\d+$` (normalization)
- Sample ID: `^D-\d+$` (validation), `^[Dd]-\d+$` (normalization)
- Character removal: `[^Rr0-9-]`, `[^Dd0-9-]`

### Validation Functions
- `validate_repair_id()`: Repair ID validation
- `validate_sample_id()`: Sample ID validation
- `postProcessExtractedFields()`: Overall post-processing

### Error Messages
- Format errors: "Field does not match required format"
- Required errors: "This field is required"
- Type errors: "Invalid data type"

