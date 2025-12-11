const Queue = require('bull');
const Redis = require('ioredis');
const logger = require('../lib/logger');

/**
 * Job Queue Service
 * Manages browser automation jobs using Bull queue with Redis
 */
class JobQueueService {
  constructor() {
    this.redisConfig = this.getRedisConfig();
    this.automationQueue = null;
    this.redisClient = null;
  }

  /**
   * Get Redis configuration from environment variables
   */
  getRedisConfig() {
    // Support both REDIS_URL and individual Redis config
    if (process.env.REDIS_URL) {
      return {
        url: process.env.REDIS_URL,
        connectTimeout: 5000, // 5 second connection timeout
        lazyConnect: true, // Don't connect immediately
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying after 3 attempts
          }
          return Math.min(times * 200, 2000); // Exponential backoff
        }
      };
    }

    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      connectTimeout: 5000, // 5 second connection timeout
      lazyConnect: true, // Don't connect immediately - connect on first use
      maxRetriesPerRequest: null, // Required for Bull
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 200, 2000); // Exponential backoff
      }
    };
  }

  /**
   * Initialize the job queue
   */
  async initialize() {
    try {
      // Create Redis connection with lazy connect
      this.redisClient = new Redis(this.redisConfig);
      
      // Set up error handlers BEFORE connecting
      this.redisClient.on('error', (error) => {
        logger.error('[JobQueue] Redis connection error', {
          error: error.message,
          code: error.code
        });
      });
      
      this.redisClient.on('connect', () => {
        logger.info('[JobQueue] Redis connected');
      });
      
      this.redisClient.on('ready', () => {
        logger.info('[JobQueue] Redis ready');
      });
      
      this.redisClient.on('close', () => {
        logger.warn('[JobQueue] Redis connection closed');
      });
      
      // Try to connect with timeout
      const connectPromise = this.redisClient.connect().catch((error) => {
        logger.error('[JobQueue] Failed to connect to Redis', {
          error: error.message,
          host: this.redisConfig.host || this.redisConfig.url,
          port: this.redisConfig.port
        });
        throw error;
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Redis connection timeout after 5 seconds'));
        }, 5000);
      });
      
      // Wait for connection with timeout
      await Promise.race([connectPromise, timeoutPromise]);

      // Create Bull queue
      this.automationQueue = new Queue('browser-automation', {
        createClient: (type) => {
          // Bull uses different Redis clients for different purposes
          // Return the same client for all types
          return this.redisClient;
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000 // Keep max 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600 // Keep failed jobs for 7 days
          }
        }
      });

      // Set up queue event listeners
      this.setupEventListeners();

      logger.info('[JobQueue] Initialized browser automation queue', {
        redisHost: this.redisConfig.host || this.redisConfig.url?.substring(0, 20) + '...',
        redisPort: this.redisConfig.port
      });

      return this.automationQueue;
    } catch (error) {
      logger.error('[JobQueue] Failed to initialize queue', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Set up queue event listeners for monitoring
   */
  setupEventListeners() {
    if (!this.automationQueue) return;

    this.automationQueue.on('completed', (job, result) => {
      logger.info('[JobQueue] Job completed', {
        jobId: job.id,
        result: result
      });
    });

    this.automationQueue.on('failed', (job, error) => {
      logger.error('[JobQueue] Job failed', {
        jobId: job.id,
        error: error.message,
        attemptsMade: job.attemptsMade
      });
    });

    this.automationQueue.on('stalled', (job) => {
      logger.warn('[JobQueue] Job stalled', {
        jobId: job.id
      });
    });

    this.automationQueue.on('progress', (job, progress) => {
      logger.debug('[JobQueue] Job progress', {
        jobId: job.id,
        progress: progress
      });
    });
  }

  /**
   * Add a browser automation job to the queue
   * @param {Object} jobData - Job data
   * @param {string} jobData.project_id - Project ID
   * @param {Object} jobData.defect_data - Defect data from AI analysis
   * @param {string} jobData.user_id - User ID
   * @param {string} jobData.upload_id - Upload ID
   * @param {string} jobData.asbuilt_record_id - As-built record ID (optional, will be set after record creation)
   * @returns {Promise<Object>} - Job object with id
   */
  async addAutomationJob(jobData) {
    if (!this.automationQueue) {
      throw new Error('Job queue not initialized. Call initialize() first.');
    }
    
    // Check if Redis is connected
    if (this.redisClient && this.redisClient.status !== 'ready') {
      logger.warn('[JobQueue] Redis not ready, attempting to reconnect...', {
        status: this.redisClient.status
      });
      try {
        await this.redisClient.connect();
      } catch (error) {
        throw new Error(`Redis connection failed: ${error.message}`);
      }
    }

    try {
      const job = await this.automationQueue.add('browser-automation', {
        project_id: jobData.project_id,
        defect_data: jobData.defect_data,
        user_id: jobData.user_id,
        upload_id: jobData.upload_id,
        asbuilt_record_id: jobData.asbuilt_record_id
      }, {
        jobId: `automation-${jobData.upload_id || Date.now()}-${Math.random().toString(36).substring(7)}`,
        timeout: 300000, // 5 minutes timeout
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false
      });

      logger.info('[JobQueue] Automation job added', {
        jobId: job.id,
        projectId: jobData.project_id,
        uploadId: jobData.upload_id
      });

      return {
        jobId: job.id,
        status: 'queued'
      };
    } catch (error) {
      logger.error('[JobQueue] Failed to add automation job', {
        error: error.message,
        jobData
      });
      throw error;
    }
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Object|null>} - Job object or null
   */
  async getJob(jobId) {
    if (!this.automationQueue) {
      throw new Error('Job queue not initialized');
    }

    try {
      const job = await this.automationQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress();

      return {
        id: job.id,
        data: job.data,
        state: state,
        progress: progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    } catch (error) {
      logger.error('[JobQueue] Failed to get job', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all jobs for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Array of job objects
   */
  async getJobsByProject(projectId) {
    if (!this.automationQueue) {
      throw new Error('Job queue not initialized');
    }

    try {
      const jobs = await this.automationQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, -1);
      
      return jobs
        .filter(job => job.data.project_id === projectId)
        .map(job => ({
          id: job.id,
          data: job.data,
          state: job.opts?.state || 'unknown',
          progress: job.progress(),
          returnvalue: job.returnvalue,
          failedReason: job.failedReason
        }));
    } catch (error) {
      logger.error('[JobQueue] Failed to get jobs by project', {
        projectId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Close the queue and Redis connection
   */
  async close() {
    if (this.automationQueue) {
      await this.automationQueue.close();
      this.automationQueue = null;
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }

    logger.info('[JobQueue] Queue and Redis connections closed');
  }
}

// Export singleton instance
const jobQueueService = new JobQueueService();

module.exports = jobQueueService;

