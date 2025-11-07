const path = require('path');
const fs = require('fs');

// Catalogue of sample filenames discovered from local upload history.
// This helps future updates stay grounded in real vocabulary used by the field teams.
const sampleFilenames = (() => {
  const uploadsDir = path.resolve(__dirname, '../../uploaded_documents');
  const samples = [];

  try {
    if (fs.existsSync(uploadsDir)) {
      const projectDirs = fs.readdirSync(uploadsDir, { withFileTypes: true });
      projectDirs
        .filter(entry => entry.isDirectory())
        .forEach(projectDir => {
          const projectPath = path.join(uploadsDir, projectDir.name);
          const projectFiles = fs.readdirSync(projectPath, { withFileTypes: true });
          projectFiles
            .filter(file => file.isFile())
            .forEach(file => {
              samples.push(file.name);
            });
        });
    }
  } catch (error) {
    // Sampling is best-effort and should never break classification.
    console.warn('⚠️ [FilenameClassifier] Unable to load sample filenames:', error.message);
  }

  return samples;
})();

const normalize = value => (value || '').toLowerCase();
const collapseSeparators = value => normalize(value).replace(/[\s_\-]+/g, '');
const replaceSeparatorsWithSpace = value => normalize(value).replace(/[\s_\-]+/g, ' ');

const placementSignals = [
  'panel placement',
  'placement log',
  'placement summary',
  'placement checklist',
  'placement audit',
  'placement record',
  'placement tracker',
  'panel layout',
  'layout map',
  'layout verification',
  'panel locations',
  'panel location',
  'location log',
  'location map',
  'panel grid',
  'panel assignment',
  'panel mapping',
  'layout record',
  'placement map',
  'placement matrix'
];

const placementSingleWordSignals = ['placement', 'layout'];

const nonPlacementSignals = {
  panel_seaming: [
    'seam',
    'seaming',
    'seam log',
    'seaming log',
    'weld',
    'welding',
    'trial seam',
    'fusion weld'
  ],
  non_destructive: [
    'ndt',
    'non destructive',
    'non-destructive',
    'air lance',
    'vacuum box',
    'vac-box',
    'spark test',
    'holiday test'
  ],
  trial_weld: [
    'trial weld',
    'pre-qual weld',
    'trial strip'
  ],
  repairs: [
    'repair',
    'patch log',
    'patch record',
    'defect log',
    'punch list'
  ],
  destructive: [
    'destructive',
    'lab test',
    'shear test',
    'peel test'
  ]
};

const stakeholders = [
  'Field QA leads',
  'Document control team',
  'Panel installation supervisors'
];

const matchesSignal = (name, token) => {
  const normalizedName = normalize(name);
  const spacedName = replaceSeparatorsWithSpace(name);
  const collapsedName = collapseSeparators(name);
  const normalizedToken = normalize(token);
  const collapsedToken = collapseSeparators(token);

  if (!normalizedToken) {
    return false;
  }

  const normalizedPattern = normalizedToken.replace(/[-_/]+/g, ' ');

  if (normalizedName.includes(normalizedToken)) {
    return true;
  }

  if (spacedName.includes(normalizedPattern)) {
    return true;
  }

  if (collapsedToken && collapsedName.includes(collapsedToken)) {
    return true;
  }

  return false;
};

const containsPlacementWord = name => {
  const normalizedName = normalize(name);
  const spacedName = replaceSeparatorsWithSpace(name);

  return placementSingleWordSignals.some(token => {
    if (token === 'placement') {
      if (normalizedName.includes('replacement')) {
        return false;
      }
      return new RegExp(`(?:^|[^a-z])${token}(?:[^a-z]|$)`).test(normalizedName) ||
        new RegExp(`(?:^|\s)${token}(?:\s|$)`).test(spacedName);
    }

    return new RegExp(`(?:^|[^a-z])${token}(?:[^a-z]|$)`).test(normalizedName) ||
      new RegExp(`(?:^|\s)${token}(?:\s|$)`).test(spacedName);
  });
};

const getManualOverrideFromContext = context => {
  if (!context) {
    return null;
  }

  if (context.overrideDomain) {
    return { domain: context.overrideDomain, reason: 'manual_override' };
  }

  if (context.forcePlacement) {
    return { domain: 'panel_placement', reason: 'manual_override_force' };
  }

  return null;
};

const classifyFilename = (fileName, context = {}) => {
  const normalizedName = normalize(fileName);

  const overrideDecision = getManualOverrideFromContext(context);
  if (overrideDecision) {
    return {
      decision: overrideDecision.domain === 'panel_placement' ? 'placement' : 'non_placement',
      domain: overrideDecision.domain,
      reason: overrideDecision.reason,
      matchedRule: 'manual-override',
      overrideApplied: true,
      shouldProcess: true,
      fallbackApplied: false,
      requestedDomain: context.requestedDomain || null,
      fileName: fileName || 'Unknown'
    };
  }

  const matchedNonPlacement = Object.entries(nonPlacementSignals).find(([, signals]) =>
    signals.some(signal => matchesSignal(normalizedName, signal))
  );

  if (matchedNonPlacement) {
    const [domain, signals] = matchedNonPlacement;
    const matchedToken = signals.find(signal => matchesSignal(normalizedName, signal));

    return {
      decision: 'non_placement',
      domain,
      reason: 'matched_non_placement_signal',
      matchedRule: matchedToken,
      overrideApplied: false,
      shouldProcess: true,
      fallbackApplied: false,
      requestedDomain: context.requestedDomain || null,
      fileName: fileName || 'Unknown'
    };
  }

  const matchedPlacement = placementSignals.find(signal => matchesSignal(normalizedName, signal));

  if (matchedPlacement || containsPlacementWord(normalizedName)) {
    const matchedRule = matchedPlacement || 'placement';
    return {
      decision: 'placement',
      domain: 'panel_placement',
      reason: 'matched_placement_signal',
      matchedRule,
      overrideApplied: false,
      shouldProcess: true,
      fallbackApplied: false,
      requestedDomain: context.requestedDomain || null,
      fileName: fileName || 'Unknown'
    };
  }

  return {
    decision: 'non_placement',
    domain: null,
    reason: 'fallback_non_placement',
    matchedRule: null,
    overrideApplied: false,
    shouldProcess: false,
    fallbackApplied: true,
    requestedDomain: context.requestedDomain || null,
    fileName: fileName || 'Unknown'
  };
};

const summarizeRules = () => ({
  placementSignals,
  placementSingleWordSignals,
  nonPlacementSignals,
  fallback: 'Files that do not match any list default to non-placement and are skipped to stay safe.',
  stakeholders,
  sampleFilenames
});

module.exports = {
  classifyFilename,
  summarizeRules,
  sampleFilenames,
  placementSignals,
  placementSingleWordSignals,
  nonPlacementSignals,
  stakeholders
};
