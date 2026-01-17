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
    // Try to initialize job queue - if Redis is not available, log warning and exit gracefully
    let automationQueue;
    try {
      await jobQueue.initialize();
      automationQueue = jobQueue.automationQueue;
    } catch (queueError) {
      logger.error('[Worker] Failed to initialize job queue. Redis may not be available.', {
        error: queueError.message,
        hint: 'If Redis is not needed, you can disable this worker service. Otherwise, ensure Redis is running and REDIS_URL is configured correctly.'
      });
      
      // Exit gracefully instead of crashing
      logger.warn('[Worker] Worker cannot function without Redis. Exiting gracefully.');
      process.exit(0); // Exit with 0 to prevent Render from restarting
      return;
    }
    
    const automationWorker = new AutomationWorker();

    // Process defect-based automation jobs
    automationQueue.process('browser-automation', async (job) => {
      return await automationWorker.processJob(job);
    });

    // Process form automation jobs
    automationQueue.process('form-automation', async (job) => {
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
    
    // If it's a Redis connection error, exit gracefully to prevent restart loop
    if (error.message?.includes('Redis') || error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED' || error.message?.includes('Connection is closed')) {
      logger.warn('[Worker] Redis connection failed. Exiting gracefully to prevent restart loop.');
      logger.warn('[Worker] To fix: Ensure Redis service is running and REDIS_URL is configured correctly.');
      logger.warn('[Worker] If Redis is not needed, you can disable this worker service on Render.');
      process.exit(0); // Exit with 0 to prevent Render from restarting
    } else {
      // For other errors, exit with error code
      process.exit(1);
    }
  }
})();

