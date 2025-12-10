const axios = require('axios');
const { Pool } = require('pg');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Automation Worker
 * Processes browser automation jobs from the queue
 */
class AutomationWorker {
  constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    this.AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
  }

  /**
   * Process a browser automation job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} - Job result
   */
  async processJob(job) {
    const { project_id, defect_data, user_id, upload_id, asbuilt_record_id } = job.data;
    const jobId = job.id;

    logger.info('[AutomationWorker] Processing job', {
      jobId,
      projectId: project_id,
      uploadId: upload_id
    });

    try {
      // Update job status in database to 'processing'
      await this.updateJobStatus(jobId, 'processing', 0, null, asbuilt_record_id);

      // Update progress: 10% - Starting
      await job.progress(10);
      await this.updateJobStatus(jobId, 'processing', 10, null, asbuilt_record_id);

      // Call AI service for browser automation
      logger.info('[AutomationWorker] Calling AI service for browser automation', {
        jobId,
        aiServiceUrl: this.AI_SERVICE_URL
      });

      const automationResponse = await axios.post(
        `${this.AI_SERVICE_URL}/api/ai/automate-panel-population`,
        {
          project_id: project_id,
          defect_data: defect_data,
          user_id: user_id,
          upload_id: upload_id
        },
        {
          timeout: 300000, // 5 minutes timeout
          headers: {
            'Content-Type': 'application/json'
          },
          onUploadProgress: (progressEvent) => {
            // Update progress based on upload progress (10-90%)
            const progress = 10 + Math.floor((progressEvent.loaded / progressEvent.total) * 80);
            job.progress(progress);
            this.updateJobStatus(jobId, 'processing', progress, null, asbuilt_record_id).catch(err => {
              logger.warn('[AutomationWorker] Failed to update progress', { error: err.message });
            });
          }
        }
      );

      // Update progress: 90% - Processing response
      await job.progress(90);
      await this.updateJobStatus(jobId, 'processing', 90, null, asbuilt_record_id);

      const result = {
        status: automationResponse.data.status || 'success',
        message: automationResponse.data.message || 'Panel layout updated successfully',
        panels_created: automationResponse.data.panels_created || 0,
        details: automationResponse.data.details || {}
      };

      // Update progress: 100% - Completed
      await job.progress(100);
      await this.updateJobStatus(jobId, 'completed', 100, result, asbuilt_record_id);

      logger.info('[AutomationWorker] Job completed successfully', {
        jobId,
        result
      });

      return result;
    } catch (error) {
      logger.error('[AutomationWorker] Job failed', {
        jobId,
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });

      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      
      // Update job status to 'failed'
      await this.updateJobStatus(jobId, 'failed', job.progress() || 0, null, asbuilt_record_id, errorMessage);

      throw error;
    }
  }

  /**
   * Update job status in database
   * @param {string} jobId - Job ID
   * @param {string} status - Job status
   * @param {number} progress - Job progress (0-100)
   * @param {Object} result - Job result
   * @param {string} asbuiltRecordId - As-built record ID
   * @param {string} errorMessage - Error message if failed
   */
  async updateJobStatus(jobId, status, progress, result, asbuiltRecordId, errorMessage = null) {
    const client = await this.pool.connect();
    try {
      const now = new Date();
      
      // Check if job record exists
      const existingJob = await client.query(
        'SELECT id FROM automation_jobs WHERE job_id = $1',
        [jobId]
      );

      if (existingJob.rows.length === 0) {
        // Create new job record
        await client.query(
          `INSERT INTO automation_jobs (
            job_id, asbuilt_record_id, project_id, status, progress, result, error_message, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            jobId,
            asbuiltRecordId,
            result?.project_id || null, // Will be updated when we have project_id
            status,
            progress,
            result ? JSON.stringify(result) : null,
            errorMessage,
            now
          ]
        );
      } else {
        // Update existing job record
        const updateFields = ['status = $2', 'progress = $3'];
        const updateValues = [jobId, status, progress];
        let paramIndex = 4;

        if (result !== null) {
          updateFields.push(`result = $${paramIndex}`);
          updateValues.push(JSON.stringify(result));
          paramIndex++;
        }

        if (errorMessage !== null) {
          updateFields.push(`error_message = $${paramIndex}`);
          updateValues.push(errorMessage);
          paramIndex++;
        }

        if (status === 'processing' && !existingJob.rows[0].started_at) {
          updateFields.push(`started_at = $${paramIndex}`);
          updateValues.push(now);
          paramIndex++;
        }

        if (status === 'completed' || status === 'failed') {
          updateFields.push(`completed_at = $${paramIndex}`);
          updateValues.push(now);
          paramIndex++;
        }

        if (asbuiltRecordId) {
          updateFields.push(`asbuilt_record_id = $${paramIndex}`);
          updateValues.push(asbuiltRecordId);
          paramIndex++;
        }

        await client.query(
          `UPDATE automation_jobs SET ${updateFields.join(', ')} WHERE job_id = $1`,
          updateValues
        );
      }
    } catch (error) {
      logger.error('[AutomationWorker] Failed to update job status in database', {
        jobId,
        error: error.message
      });
      // Don't throw - job processing should continue even if DB update fails
    } finally {
      client.release();
    }
  }

  /**
   * Update project_id in job record (called after asbuilt record is created)
   * @param {string} jobId - Job ID
   * @param {string} projectId - Project ID
   */
  async updateProjectId(jobId, projectId) {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE automation_jobs SET project_id = $1 WHERE job_id = $2',
        [projectId, jobId]
      );
    } catch (error) {
      logger.error('[AutomationWorker] Failed to update project_id', {
        jobId,
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = AutomationWorker;

