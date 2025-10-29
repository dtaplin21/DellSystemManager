const { createPromptTemplate } = require('./base');

module.exports = createPromptTemplate({
  id: 'general_header_mapping',
  version: '1.0',
  created: '2025-01-28',
  accuracyBaseline: null,
  improvements: [
    'Fallback template for unsupported domains'
  ],
  systemTemplate: `You normalize spreadsheet headers into canonical field names for construction quality control data.
Always respond with valid JSON including mapping, confidence (0-1), inferred domain label, and short reasoning.
`,
  userTemplate: `HEADERS: {headers}
CANONICAL FIELDS: {canonicalFields}
SAMPLE DATA: {sampleData}
If a header does not match any canonical field, omit it from the mapping.`
});
