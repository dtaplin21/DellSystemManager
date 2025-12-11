#!/usr/bin/env node

/**
 * Automation Worker Process
 * Processes browser automation jobs from the Bull queue
 * 
 * Run this as a separate process: node backend/workers/start-worker.js
 * Or use PM2: pm2 start backend/workers/start-worker.js --name automation-worker
 */

require('dotenv').config();
const Queue = require('bull');
const Redis = require('ioredis');
const AutomationWorker = require('../services/automationWorker');
const logger = require('../lib/logger');
const jobQueue = require('../services/jobQueue');

// Initialize job queue and start processing
(async () => {
  try {
    await jobQueue.initialize();
    const automationQueue = jobQueue.automationQueue;
    const automationWorker = new AutomationWorker();

    // Process jobs
    automationQueue.process('browser-automation', async (job) => {
      return await automationWorker.processJob(job);
    });

    // Set up event listeners
    automationQueue.on('completed', (job, result) => {
      logger.info('[Worker] Job completed', {
        jobId: job.id,
        result: result
      });
    });

    automationQueue.on('failed', (job, error) => {
      logger.error('[Worker] Job failed', {
        jobId: job.id,
        error: error.message,
        attemptsMade: job.attemptsMade
      });
    });

    automationQueue.on('stalled', (job) => {
      logger.warn('[Worker] Job stalled', {
        jobId: job.id
      });
    });

    automationQueue.on('progress', (job, progress) => {
      logger.debug('[Worker] Job progress', {
        jobId: job.id,
        progress: progress
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('[Worker] SIGTERM received, shutting down gracefully...');
      await automationQueue.close();
      await automationWorker.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('[Worker] SIGINT received, shutting down gracefully...');
      await automationQueue.close();
      await automationWorker.close();
      process.exit(0);
    });

    logger.info('[Worker] Automation worker started and ready to process jobs');
  } catch (error) {
    logger.error('[Worker] Failed to initialize worker', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
})();

