const { createPromptTemplate } = require('./base');

module.exports = createPromptTemplate({
  id: 'repairs_header_mapping',
  version: '1.0',
  created: '2025-01-28',
  accuracyBaseline: null,
  improvements: [
    'Captured defect and resolution hints',
    'Added technician credential reminder',
    'Highlighted date/notes disambiguation'
  ],
  systemTemplate: `You are assisting with repair log normalization.

CONSIDERATIONS:
- Repair IDs can be alphanumeric (e.g., R-102A)
- Issue descriptions may span multiple columns
- Technician or crew initials should map to technician
- Date fields must stay in ISO 8601 format when possible
`,
  userTemplate: `HEADERS: {headers}
CANONICAL FIELDS: {canonicalFields}
SAMPLE ROWS: {sampleData}
Return JSON mapping with confidence (0-1), domain "repairs", and a short reasoning summary.`
});
