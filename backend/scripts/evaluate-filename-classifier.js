#!/usr/bin/env node

const path = require('path');
const { classifyFilename, summarizeRules } = require('../services/filenameClassifier');

const uploadsDir = path.resolve(__dirname, '../../uploaded_documents');

const evaluate = () => {
  const { sampleFilenames } = summarizeRules();
  const summary = {
    uploadsDir,
    total: sampleFilenames.length,
    placement: 0,
    nonPlacement: 0,
    skipped: 0,
    byDomain: {},
    files: []
  };

  sampleFilenames.forEach(fileName => {
    const decision = classifyFilename(fileName);
    if (decision.decision === 'placement') {
      summary.placement += 1;
    } else if (decision.shouldProcess && decision.domain) {
      summary.nonPlacement += 1;
      summary.byDomain[decision.domain] = (summary.byDomain[decision.domain] || 0) + 1;
    } else {
      summary.skipped += 1;
    }

    summary.files.push({
      fileName,
      decision: decision.decision,
      domain: decision.domain,
      reason: decision.reason,
      matchedRule: decision.matchedRule
    });
  });

  console.log(JSON.stringify(summary, null, 2));
};

evaluate();
