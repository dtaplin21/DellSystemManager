const { createPromptTemplate } = require('./base');

module.exports = createPromptTemplate({
  id: 'destructive_header_mapping',
  version: '1.0',
  created: '2025-01-28',
  accuracyBaseline: null,
  improvements: [
    'Specified lab sample metadata',
    'Added pass/fail nuance for lab metrics',
    'Clarified mapping for tester initials'
  ],
  systemTemplate: `You assist with destructive testing lab reports.

IMPORTANT NOTES:
- Sample IDs often combine panel + lab sample numbers
- Lab names may appear as facility codes (e.g., "ATL", "INT")
- Pass/fail fields may include numeric thresholds; treat numeric values as measurements
- Tester initials should map to testerInitials
`,
  userTemplate: `HEADERS TO ANALYZE: {headers}
CANONICAL FIELDS: {canonicalFields}
SAMPLE DATA: {sampleData}
Return JSON mapping + confidence + reasoning. Domain must be "destructive".`
});
