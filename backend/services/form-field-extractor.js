const OpenAI = require('openai');

class FormFieldExtractor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Extract form fields from defect image using OpenAI Vision
   * Returns structured data matching MetadataFormView schema
   */
  async extractFormFields(imageBuffer, imageType = 'image/jpeg') {
    try {
      console.log('🔍 Extracting form fields from image using OpenAI Vision...');
      console.log('📊 Image buffer size:', imageBuffer.length, 'bytes');
      console.log('📊 Image type:', imageType);
      
      const base64Image = imageBuffer.toString('base64');
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting defect report information from images for geosynthetic engineering quality control. 

Your task is to extract ALL visible text and information from defect photos, including:
- Location information (coordinates, landmarks, section numbers, GPS data, location descriptions)
- Defect type (crack, tear, hole, puncture, seam issue, material defect, etc.)
- Notes/descriptions written on or near the defect
- Panel numbers/IDs (could be written as "Panel #", "P-", "Panel ID", etc.)
- Material specifications (material type, brand, specifications)
- Thickness measurements (could be written as "thickness", "mil", "mm", etc.)
- Seams/seaming information (seam type, seam location, seam details)
- Form type indicators (defect report, repair form, as-built record)

You must read BOTH:
- Handwritten notes on the defect or photo
- Printed labels, tags, or forms visible in the image

Extraction rules:
1. Extract location from any visible text (e.g., "Section 5", "North quadrant", "Lat: 40.5, Long: -74.2", etc.)
2. Identify defect type from descriptions or labels (e.g., "crack", "tear", "hole")
3. Extract all notes, comments, or descriptions visible
4. Look for panel numbers in various formats (Panel 123, P-123, Panel#123, etc.)
5. Find material specs (e.g., "HDPE 60 mil", "Geomembrane", "Material: X")
6. Extract thickness measurements (numbers with units like mil, mm, inches)
7. Identify seams information if present
8. Determine form type from context (defect report if defect visible, repair form if repair work shown, as-built if installation record)

Return ONLY the fields you can confidently detect. Leave fields empty if not found.

IMPORTANT: Return valid JSON matching the exact schema. If text is unclear or you're uncertain, omit that field rather than guessing.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all form field information from this defect photo. Return a JSON object with only the fields you can confidently detect from the image. Include location, defect type, notes, panel number, material, thickness, seams type, and form type if visible."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500
      });

      console.log('✅ OpenAI Vision response received');
      console.log('📊 Response usage:', response.usage);
      
      const responseContent = response.choices[0].message.content;
      console.log('📄 Raw response content:', responseContent);
      
      let extractedData;
      try {
        extractedData = JSON.parse(responseContent);
        console.log('✅ Form fields extracted successfully');
        console.log('📊 Extracted fields:', Object.keys(extractedData));
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('❌ Raw response content:', responseContent);
        throw new Error(`Invalid JSON response from OpenAI Vision: ${parseError.message}`);
      }

      // Normalize and validate extracted data
      const normalizedFields = this.normalizeExtractedFields(extractedData);
      
      // Convert to snake_case for API response (matches Swift decoder expectations)
      const apiFields = {
        location: normalizedFields.location,
        defect_type: normalizedFields.defectType,
        notes: normalizedFields.notes,
        panel_number: normalizedFields.panelNumber,
        material: normalizedFields.material,
        thickness: normalizedFields.thickness,
        seams_type: normalizedFields.seamsType,
        form_type: normalizedFields.formType
      };
      
      // Calculate confidence score based on number of fields extracted
      const fieldCount = Object.values(normalizedFields).filter(v => v !== null && v !== undefined && v !== '').length;
      const confidence = Math.min(0.95, 0.5 + (fieldCount * 0.075)); // 0.5 base + 0.075 per field, max 0.95
      
      return {
        success: true,
        extractedFields: apiFields,
        confidence: confidence,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error extracting form fields:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status
      });
      
      if (error.name === 'OpenAIError') {
        console.error('❌ OpenAI API error details:', {
          status: error.status,
          code: error.code,
          type: error.type
        });
        throw new Error(`OpenAI Vision API error: ${error.message}`);
      }
      
      throw new Error(`Failed to extract form fields from image: ${error.message}`);
    }
  }

  /**
   * Normalize extracted fields to match MetadataFormView schema
   */
  normalizeExtractedFields(rawData) {
    const normalized = {
      location: null,
      defectType: null,
      notes: null,
      panelNumber: null,
      material: null,
      thickness: null,
      seamsType: null,
      formType: null
    };

    // Location - check multiple possible keys
    normalized.location = rawData.location || 
                         rawData.loc || 
                         rawData.locationDescription || 
                         rawData.coordinates ||
                         rawData.position ||
                         null;

    // Defect Type - check multiple possible keys
    normalized.defectType = rawData.defectType || 
                           rawData.defect_type || 
                           rawData.type || 
                           rawData.defect ||
                           null;

    // Notes - check multiple possible keys
    normalized.notes = rawData.notes || 
                      rawData.description || 
                      rawData.comments || 
                      rawData.remarks ||
                      null;

    // Panel Number - check multiple possible keys and formats
    const panelValue = rawData.panelNumber || 
                      rawData.panel_number || 
                      rawData.panelId || 
                      rawData.panel_id ||
                      rawData.panel ||
                      null;
    
    // Clean panel number (remove common prefixes/suffixes if present)
    if (panelValue) {
      normalized.panelNumber = String(panelValue).replace(/^(Panel|P-|Panel\s*#?\s*)/i, '').trim();
      if (normalized.panelNumber === '') {
        normalized.panelNumber = null;
      }
    }

    // Material - check multiple possible keys
    normalized.material = rawData.material || 
                         rawData.materialType || 
                         rawData.material_type ||
                         null;

    // Thickness - check multiple possible keys
    normalized.thickness = rawData.thickness || 
                          rawData.thicknessValue || 
                          rawData.thickness_value ||
                          null;

    // Seams Type - check multiple possible keys
    normalized.seamsType = rawData.seamsType || 
                          rawData.seams_type || 
                          rawData.seamType || 
                          rawData.seam_type ||
                          null;

    // Form Type - validate against allowed values
    const formTypeValue = rawData.formType || 
                         rawData.form_type || 
                         rawData.type ||
                         null;
    
    if (formTypeValue) {
      const normalizedFormType = String(formTypeValue).toLowerCase().trim();
      if (['defect_report', 'repair_form', 'asbuilt_form'].includes(normalizedFormType)) {
        normalized.formType = normalizedFormType;
      } else {
        // Try to infer from context
        if (normalizedFormType.includes('repair') || normalizedFormType.includes('patch')) {
          normalized.formType = 'repair_form';
        } else if (normalizedFormType.includes('as-built') || normalizedFormType.includes('asbuilt')) {
          normalized.formType = 'asbuilt_form';
        } else {
          normalized.formType = 'defect_report'; // Default
        }
      }
    }

    // Clean up empty strings
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === '' || normalized[key] === undefined) {
        normalized[key] = null;
      }
    });

    return normalized;
  }
}

module.exports = FormFieldExtractor;

