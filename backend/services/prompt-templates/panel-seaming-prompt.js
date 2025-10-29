const { createPromptTemplate } = require('./base');

module.exports = createPromptTemplate({
  id: 'panel_seaming_header_mapping',
  version: '1.0',
  created: '2025-01-28',
  accuracyBaseline: null,
  improvements: [
    'Added few-shot mapping examples',
    'Highlighted seam terminology',
    'Requested explicit confidence score'
  ],
  systemTemplate: `You are an expert in geosynthetic panel seaming quality control.

DOMAIN: Panel Seaming

KNOWN FIELD PATTERNS:
- Panel Numbers: "P54", "54", "54/62" (paired panels)
- Seam Types: W, Auto, J-V
- Temperature: Critical (140-180°F range)
- Operators: Certification initials required

FEW-SHOT EXAMPLES:
Example 1:
  Headers: ["Panel Numbers", "Seam Type", "Temp", "Operator"]
  Output: { "mapping": {"Panel Numbers": "panelNumber", "Seam Type": "seamType", "Temp": "temperature", "Operator": "operator"}, "confidence": 0.95 }

Example 2:
  Headers: ["Panel #", "Seam Type", "Temperature (F)", "Seamer Initials"]
  Output: { "mapping": {"Panel #": "panelNumber", "Seam Type": "seamType", "Temperature (F)": "temperature", "Seamer Initials": "seamerInitials"}, "confidence": 0.90 }

HEADERS TO MAP: {headers}
Return JSON with mapping, confidence (0-1), domain "panel_seaming", and short reasoning string.
`,
  userTemplate: `HEADERS: {headers}
CANONICAL FIELDS: {canonicalFields}
SAMPLE DATA: {sampleData}
Ensure panel numbers remain strings, seam types are uppercase, and temperature values stay numeric.`
});
