const { createPromptTemplate } = require('./base');

module.exports = createPromptTemplate({
  id: 'non_destructive_header_mapping',
  version: '1.0',
  created: '2025-01-28',
  accuracyBaseline: null,
  improvements: [
    'Clarified test terminology',
    'Added inspector/operator disambiguation',
    'Captured pass/fail expectations'
  ],
  systemTemplate: `You specialize in mapping headers for non-destructive testing (NDT) logs.

NDT CONTEXT:
- Common tests: Air Pressure, Vacuum Box, Spark
- Pass/fail fields may contain strings like "PASS", "Fail", "Fail - rework"
- Inspector initials are mandatory in most reports

EXPECTED OUTPUT:
{
  "mapping": {"header": "canonical"},
  "confidence": 0-1,
  "domain": "non_destructive",
  "reasoning": "two sentence summary"
}
`,
  userTemplate: `HEADERS PROVIDED: {headers}
AVAILABLE FIELDS: {canonicalFields}
SAMPLE ROWS: {sampleData}
Prefer mapping to inspector/operator fields when initials are present and include confidence score.`
});
