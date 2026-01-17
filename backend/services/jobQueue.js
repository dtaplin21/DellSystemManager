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
      // Parse Redis URL to extract host, port, password, and db
      // ioredis works better with explicit host/port than URL string
      try {
        const redisUrl = new URL(process.env.REDIS_URL);
        return {
          host: redisUrl.hostname,
          port: parseInt(redisUrl.port || '6379', 10),
          password: redisUrl.password || undefined,
          db: parseInt((redisUrl.pathname || '/0').substring(1) || '0', 10),
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
      } catch (error) {
        // If URL parsing fails, log error and fall back to string format
        logger.warn('[JobQueue] Failed to parse REDIS_URL, using as string', {
          error: error.message,
          redisUrl: process.env.REDIS_URL?.substring(0, 30) + '...'
        });
        // ioredis v5+ can accept URL string directly
        return process.env.REDIS_URL;
      }
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
      // Log Redis configuration (masked for security)
      const configForLogging = typeof this.redisConfig === 'string' 
        ? { url: this.redisConfig.substring(0, 30) + '...' }
        : {
            host: this.redisConfig.host,
            port: this.redisConfig.port,
            db: this.redisConfig.db,
            hasPassword: !!this.redisConfig.password
          };
      logger.info('[JobQueue] Initializing Redis connection', configForLogging);
      
      // Create Redis connection with lazy connect
      this.redisClient = new Redis(this.redisConfig);
      
      // Set up error handlers BEFORE connecting
      this.redisClient.on('error', (error) => {
        logger.error('[JobQueue] Redis connection error', {
          error: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall
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
      
      // Test connection with PING (lazyConnect will connect automatically)
      const connectPromise = this.redisClient.ping().then((result) => {
        if (result !== 'PONG') {
          throw new Error('Redis PING failed - unexpected response');
        }
        logger.info('[JobQueue] Redis connection verified with PING');
        return result;
      }).catch((error) => {
        const configInfo = typeof this.redisConfig === 'string'
          ? { redisUrl: this.redisConfig.substring(0, 50) + '...' }
          : {
              host: this.redisConfig.host,
              port: this.redisConfig.port,
              db: this.redisConfig.db
            };
        logger.error('[JobQueue] Failed to connect to Redis', {
          error: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          ...configInfo,
          hint: error.code === 'ECONNREFUSED' 
            ? 'Connection refused - ensure Redis and Worker services are in the same region (Oregon)'
            : undefined
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
   * @param {string} jobData.type - Job type: 'form_automation' or 'defect_automation' (defaults to 'browser-automation')
   * @param {string} jobData.project_id - Project ID
   * @param {Object} jobData.defect_data - Defect data from AI analysis (for defect automation)
   * @param {Object} jobData.form_record - Form record (for form automation)
   * @param {string} jobData.item_type - Item type: 'panel', 'patch', or 'destructive_test' (for form automation)
   * @param {Object} jobData.positioning - Positioning data (for form automation)
   * @param {string} jobData.user_id - User ID
   * @param {string} jobData.upload_id - Upload ID (for defect automation)
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
      // Determine job type and queue name
      const jobType = jobData.type || 'defect_automation';
      const queueName = jobType === 'form_automation' ? 'form-automation' : 'browser-automation';
      
      // Build job data payload
      const payload = {
        type: jobType,
        project_id: jobData.project_id,
        user_id: jobData.user_id,
        asbuilt_record_id: jobData.asbuilt_record_id
      };

      // Add type-specific fields
      if (jobType === 'form_automation') {
        payload.form_record = jobData.form_record;
        payload.item_type = jobData.item_type;
        payload.positioning = jobData.positioning;
      } else {
        payload.defect_data = jobData.defect_data;
        payload.upload_id = jobData.upload_id;
      }

      // Generate job ID
      const jobIdPrefix = jobType === 'form_automation' 
        ? `form-automation-${jobData.form_record?.id || Date.now()}`
        : `automation-${jobData.upload_id || Date.now()}`;
      
      const job = await this.automationQueue.add(queueName, payload, {
        jobId: `${jobIdPrefix}-${Math.random().toString(36).substring(7)}`,
        timeout: 300000, // 5 minutes timeout
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false
      });

      logger.info('[JobQueue] Automation job added', {
        jobId: job.id,
        jobType,
        projectId: jobData.project_id,
        uploadId: jobData.upload_id,
        formId: jobData.form_record?.id
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

