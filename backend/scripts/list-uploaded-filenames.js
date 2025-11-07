#!/usr/bin/env node

const path = require('path');
const { sampleFilenames } = require('../services/filenameClassifier');

const uploadsDir = path.resolve(__dirname, '../../uploaded_documents');

const listUploads = () => {
  const payload = sampleFilenames.length ? sampleFilenames : [];
  const response = {
    uploadsDir,
    count: payload.length,
    files: payload
  };

  console.log(JSON.stringify(response, null, 2));
};

listUploads();
