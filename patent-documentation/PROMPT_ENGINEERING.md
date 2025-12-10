# Prompt Engineering

## Overview

The system uses form-type-specific prompts to guide the AI model in extracting structured data from as-built form images. Each form type has a tailored prompt that specifies the exact fields to extract and their expected formats.

## Prompt Structure

Each prompt follows this structure:
1. **Context**: Description of the form type
2. **Field List**: Detailed list of fields to extract with descriptions
3. **Format Specifications**: Expected data types and formats
4. **JSON Schema**: Exact JSON structure expected
5. **Validation Rules**: Format-specific rules (for R-{number}, D-{number})
6. **Examples**: Correct and incorrect format examples
7. **Instructions**: Null handling and confidence requirements

## System Message

All prompts are prefixed with a system message that establishes general rules:

```
You are an expert at extracting data from as-built quality control forms. 
Always return valid JSON matching the exact schema requested.

IMPORTANT ID FORMAT RULES:
- Repair IDs must include "R-" prefix (e.g., "R-2", "R-15")
- Destructive test sample IDs must include "D-" prefix (e.g., "D-5", "D-12")
- Always extract the complete ID including the prefix
- Normalize variations (spaces, case) to standard format
- If an ID is missing its required prefix, do not extract it
```

## Form-Type-Specific Prompts

### 1. Panel Placement Prompt

**Purpose**: Extract panel placement installation data

**Fields**:
- `dateTime`: Date and time of panel placement (YYYY-MM-DDTHH:mm)
- `panelNumber`: Panel identifier/number
- `locationNote`: Location description or notes
- `weatherComments`: Weather conditions or comments

**JSON Schema**:
```json
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "panelNumber": "string or null",
  "locationNote": "string or null",
  "weatherComments": "string or null"
}
```

**Key Characteristics**:
- Simple form with 4 fields
- Focus on installation metadata
- No format-specific validation required

### 2. Panel Seaming Prompt

**Purpose**: Extract seam welding and joining data

**Fields**: 15 fields including:
- `dateTime`: Date and time of seaming operation
- `panelNumbers`: Panel identifiers being seamed together
- `seamLength`: Length of seam in feet (number)
- `seamerInitials`: Initials of person performing seaming
- `machineNumber`: Seaming machine identifier
- `wedgeTemp`: Temperature in °F (number)
- `nipRollerSpeed`: Speed setting
- `barrelTemp`: Temperature in °F (number)
- `preheatTemp`: Temperature in °F (number)
- `trackPeelInside`: Measurement value (number)
- `trackPeelOutside`: Measurement value (number)
- `tensileLbsPerIn`: Tensile strength value (number)
- `tensileRate`: Rate value
- `vboxPassFail`: "Pass", "Fail", or "N/A"
- `weatherComments`: Weather conditions or comments

**JSON Schema**:
```json
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "panelNumbers": "string or null",
  "seamLength": number or null,
  "seamerInitials": "string or null",
  "machineNumber": "string or null",
  "wedgeTemp": number or null,
  "nipRollerSpeed": "string or null",
  "barrelTemp": number or null,
  "preheatTemp": number or null,
  "trackPeelInside": number or null,
  "trackPeelOutside": number or null,
  "tensileLbsPerIn": number or null,
  "tensileRate": "string or null",
  "vboxPassFail": "Pass" | "Fail" | "N/A" | null,
  "weatherComments": "string or null"
}
```

**Key Characteristics**:
- Most complex form (15 fields)
- Mix of numeric and text fields
- Temperature and measurement values
- Pass/fail enum field

### 3. Non-Destructive Testing Prompt

**Purpose**: Extract NDT inspection and testing data

**Fields**:
- `dateTime`: Date and time of test
- `panelNumbers`: Panel identifiers tested
- `operatorInitials`: Initials of test operator
- `vboxPassFail`: "Pass" or "Fail"
- `notes`: Additional notes or comments

**JSON Schema**:
```json
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "panelNumbers": "string or null",
  "operatorInitials": "string or null",
  "vboxPassFail": "Pass" | "Fail" | null,
  "notes": "string or null"
}
```

**Key Characteristics**:
- Simple form (5 fields)
- Focus on test results
- Binary pass/fail result

### 4. Trial Weld Prompt

**Purpose**: Extract trial welding test and validation data

**Fields**: 14 fields including:
- `dateTime`: Date and time of trial weld
- `seamerInitials`: Initials of person performing weld
- `machineNumber`: Welding machine identifier
- `wedgeTemp`: Temperature in °F (number)
- `nipRollerSpeed`: Speed setting
- `barrelTemp`: Temperature in °F (number)
- `preheatTemp`: Temperature in °F (number)
- `trackPeelInside`: Measurement value (number)
- `trackPeelOutside`: Measurement value (number)
- `tensileLbsPerIn`: Tensile strength value (number)
- `tensileRate`: Rate value
- `passFail`: "Pass" or "Fail"
- `ambientTemp`: Temperature in °F (number)
- `comments`: Additional comments

**JSON Schema**:
```json
{
  "dateTime": "YYYY-MM-DDTHH:mm" or null,
  "seamerInitials": "string or null",
  "machineNumber": "string or null",
  "wedgeTemp": number or null,
  "nipRollerSpeed": "string or null",
  "barrelTemp": number or null,
  "preheatTemp": number or null,
  "trackPeelInside": number or null,
  "trackPeelOutside": number or null,
  "tensileLbsPerIn": number or null,
  "tensileRate": "string or null",
  "passFail": "Pass" | "Fail" | null,
  "ambientTemp": number or null,
  "comments": "string or null"
}
```

**Key Characteristics**:
- Similar to panel seaming (14 fields)
- Focus on welding parameters
- Ambient temperature field

### 5. Repairs Prompt

**Purpose**: Extract panel repair and maintenance data

**Fields**:
- `date`: Date of repair (YYYY-MM-DD)
- `repairId`: Repair identifier in format "R-{number}" (e.g., "R-2", "R-15", "R-123")
- `panelNumbers`: Panel identifiers repaired
- `extruderNumber`: Extruder machine identifier
- `operatorInitials`: Initials of repair operator
- `typeDetailLocation`: Description of repair type, detail, and location
- `vboxPassFail`: "Pass" or "Fail"

**Format-Specific Rules**:
```
IMPORTANT: The repair ID MUST include the "R-" prefix followed by a number.
Look for patterns like: "R-2", "R-15", "R-123", "R - 5", "r-10" (normalize to "R-{number}")
If you see just a number without "R-" prefix, it is NOT a valid repair ID.
```

**Examples**:
```
✅ CORRECT: "R-2" → extract as "R-2"
✅ CORRECT: "R-15" → extract as "R-15"
✅ CORRECT: "R - 5" → extract as "R-5" (normalize spaces)
✅ CORRECT: "r-10" → extract as "R-10" (normalize case)
❌ INCORRECT: "2" → do NOT extract (missing R- prefix)
❌ INCORRECT: "Repair 2" → do NOT extract (not in R-{number} format)
❌ INCORRECT: "R2" → do NOT extract (missing hyphen, not in R-{number} format)
```

**JSON Schema**:
```json
{
  "date": "YYYY-MM-DD" or null,
  "repairId": "string or null",
  "panelNumbers": "string or null",
  "extruderNumber": "string or null",
  "operatorInitials": "string or null",
  "typeDetailLocation": "string or null",
  "vboxPassFail": "Pass" | "Fail" | null
}
```

**Key Characteristics**:
- Format-specific validation (R-{number})
- Detailed examples in prompt
- Post-processing validation required

### 6. Destructive Testing Prompt

**Purpose**: Extract destructive testing and analysis data

**Fields**:
- `date`: Date of test (YYYY-MM-DD)
- `panelNumbers`: Panel identifiers tested
- `sampleId`: Sample identifier in format "D-{number}" (e.g., "D-5", "D-12", "D-99")
- `testerInitials`: Initials of person performing test
- `machineNumber`: Testing machine identifier
- `trackPeelInside`: Measurement value (number)
- `trackPeelOutside`: Measurement value (number)
- `tensileLbsPerIn`: Tensile strength value (number)
- `tensileRate`: Rate value
- `passFail`: "Pass" or "Fail"
- `comments`: Additional comments

**Format-Specific Rules**:
```
IMPORTANT: The sample ID MUST include the "D-" prefix followed by a number.
Look for patterns like: "D-5", "D-12", "D-99", "D - 3", "d-7" (normalize to "D-{number}")
If you see just a number without "D-" prefix, it is NOT a valid sample ID.
```

**Examples**:
```
✅ CORRECT: "D-5" → extract as "D-5"
✅ CORRECT: "D-12" → extract as "D-12"
✅ CORRECT: "D - 3" → extract as "D-3" (normalize spaces)
✅ CORRECT: "d-7" → extract as "D-7" (normalize case)
❌ INCORRECT: "5" → do NOT extract (missing D- prefix)
❌ INCORRECT: "Sample 5" → do NOT extract (not in D-{number} format)
❌ INCORRECT: "D5" → do NOT extract (missing hyphen, not in D-{number} format)
```

**JSON Schema**:
```json
{
  "date": "YYYY-MM-DD" or null,
  "panelNumbers": "string or null",
  "sampleId": "string or null",
  "testerInitials": "string or null",
  "machineNumber": "string or null",
  "trackPeelInside": number or null,
  "trackPeelOutside": number or null,
  "tensileLbsPerIn": number or null,
  "tensileRate": "string or null",
  "passFail": "Pass" | "Fail" | null,
  "comments": "string or null"
}
```

**Key Characteristics**:
- Format-specific validation (D-{number})
- Detailed examples in prompt
- Post-processing validation required

## Prompt Engineering Principles

### 1. Specificity
- Each prompt is tailored to a specific form type
- Field names match domain terminology
- Data types explicitly specified

### 2. Format Enforcement
- JSON schema included in prompt
- Null handling instructions
- Enum values specified

### 3. Validation Guidance
- Format-specific rules for IDs
- Examples of correct and incorrect formats
- Clear rejection criteria

### 4. Error Prevention
- Explicit instructions to return null for unclear fields
- Confidence requirements (only extract if confident)
- JSON format enforcement

## Prompt Selection Algorithm

The system selects prompts based on form type:

```python
form_prompts = {
    'panel_placement': panelPlacementPrompt,
    'panel_seaming': panelSeamingPrompt,
    'non_destructive': nonDestructivePrompt,
    'trial_weld': trialWeldPrompt,
    'repairs': repairsPrompt,
    'destructive': destructivePrompt
}

prompt = form_prompts.get(form_type, form_prompts['panel_placement'])
```

## AI Model Configuration

- **Model**: GPT-4o
- **Temperature**: 0 (deterministic)
- **Max Tokens**: 2000
- **Response Format**: JSON object
- **System Message**: General rules and ID format requirements
- **User Message**: Form-type-specific prompt + image

## Prompt Effectiveness

### Success Metrics
- **Accuracy**: High accuracy for well-formatted forms
- **Format Compliance**: 100% JSON format compliance
- **ID Validation**: Post-processing catches format errors

### Known Limitations
- Handwritten text may have lower accuracy
- Poor image quality affects extraction
- Complex layouts may confuse field mapping

## Future Improvements

1. **Few-Shot Learning**: Include example images in prompts
2. **Context Awareness**: Use project-specific context
3. **Adaptive Prompts**: Adjust prompts based on extraction confidence
4. **Multi-Model Ensemble**: Use multiple models for validation

