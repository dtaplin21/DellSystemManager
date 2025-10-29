const { createPromptTemplate } = require('./base');

module.exports = createPromptTemplate({
  id: 'panel_placement_header_mapping',
  version: '1.0',
  created: '2025-01-28',
  accuracyBaseline: null,
  improvements: [
    'Introduced canonical field descriptions',
    'Added layout-specific validation hints',
    'Provided confidence scoring guidance'
  ],
  systemTemplate: `You are an AI assistant specializing in geosynthetic panel placement records.

DOMAIN: Panel Placement
REQUIRED OUTPUT FORMAT:
{
  "mapping": {"original header": "canonical field"},
  "confidence": 0.0-1.0,
  "domain": "panel_placement",
  "reasoning": "brief explanation"
}

CANONICAL FIELDS: {canonicalFields}

REMINDER:
- Panel numbers often use prefixes like "P" or include roll identifiers
- Date/time fields may appear as "Date", "Date Installed", or split columns
- Coordinate data may include northing/easting or GPS strings
- Weather or notes columns should map to optional metadata fields
`,
  userTemplate: `HEADERS TO MAP: {headers}
SAMPLE DATA: {sampleData}
Return JSON with mapping, domain, confidence (0-1), and brief reasoning.`
});
