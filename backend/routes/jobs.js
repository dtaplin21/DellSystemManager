const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('../lib/logger');
const jobQueue = require('../services/jobQueue');
const { auth } = require('../middlewares/auth');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/jobs/:jobId
 * Get job status by job ID
 */
router.get('/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get job from queue
    const queueJob = await jobQueue.getJob(jobId);
    
    if (!queueJob) {
      // Try to get from database
      const dbResult = await pool.query(
        'SELECT * FROM automation_jobs WHERE job_id = $1',
        [jobId]
      );

      if (dbResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      const dbJob = dbResult.rows[0];
      return res.json({
        success: true,
        job: {
          job_id: dbJob.job_id,
          status: dbJob.status,
          progress: dbJob.progress,
          result: dbJob.result,
          error_message: dbJob.error_message,
          created_at: dbJob.created_at,
          started_at: dbJob.started_at,
          completed_at: dbJob.completed_at,
          asbuilt_record_id: dbJob.asbuilt_record_id
        }
      });
    }

    // Combine queue and database data
    const dbResult = await pool.query(
      'SELECT * FROM automation_jobs WHERE job_id = $1',
      [jobId]
    );

    const dbJob = dbResult.rows[0] || {};

    res.json({
      success: true,
      job: {
        job_id: queueJob.id,
        status: queueJob.state === 'completed' ? 'completed' : 
                queueJob.state === 'failed' ? 'failed' :
                queueJob.state === 'active' ? 'processing' : 'queued',
        progress: queueJob.progress || dbJob.progress || 0,
        result: queueJob.returnvalue || dbJob.result,
        error_message: queueJob.failedReason || dbJob.error_message,
        created_at: dbJob.created_at || new Date(queueJob.timestamp),
        started_at: dbJob.started_at || (queueJob.processedOn ? new Date(queueJob.processedOn) : null),
        completed_at: dbJob.completed_at || (queueJob.finishedOn ? new Date(queueJob.finishedOn) : null),
        asbuilt_record_id: dbJob.asbuilt_record_id
      }
    });
  } catch (error) {
    logger.error('[JOBS] Error getting job status', {
      jobId: req.params.jobId,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/jobs/record/:recordId
 * Get job by asbuilt record ID
 */
router.get('/record/:recordId', auth, async (req, res) => {
  try {
    const { recordId } = req.params;

    const result = await pool.query(
      'SELECT * FROM automation_jobs WHERE asbuilt_record_id = $1 ORDER BY created_at DESC LIMIT 1',
      [recordId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        job: null
      });
    }

    const dbJob = result.rows[0];

    // Try to get updated status from queue
    let queueJob = null;
    try {
      queueJob = await jobQueue.getJob(dbJob.job_id);
    } catch (err) {
      // Job might not exist in queue anymore (completed and removed)
      logger.debug('[JOBS] Job not found in queue, using database data', { jobId: dbJob.job_id });
    }

    res.json({
      success: true,
      job: {
        job_id: dbJob.job_id,
        status: queueJob?.state === 'completed' ? 'completed' : 
                queueJob?.state === 'failed' ? 'failed' :
                queueJob?.state === 'active' ? 'processing' : dbJob.status,
        progress: queueJob?.progress || dbJob.progress || 0,
        result: queueJob?.returnvalue || dbJob.result,
        error_message: queueJob?.failedReason || dbJob.error_message,
        created_at: dbJob.created_at,
        started_at: dbJob.started_at,
        completed_at: dbJob.completed_at,
        asbuilt_record_id: dbJob.asbuilt_record_id
      }
    });
  } catch (error) {
    logger.error('[JOBS] Error getting job by record ID', {
      recordId: req.params.recordId,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/jobs/project/:projectId
 * Get all jobs for a project
 */
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await pool.query(
      'SELECT * FROM automation_jobs WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );

    res.json({
      success: true,
      jobs: result.rows.map(row => ({
        job_id: row.job_id,
        status: row.status,
        progress: row.progress,
        result: row.result,
        error_message: row.error_message,
        created_at: row.created_at,
        started_at: row.started_at,
        completed_at: row.completed_at,
        asbuilt_record_id: row.asbuilt_record_id
      }))
    });
  } catch (error) {
    logger.error('[JOBS] Error getting jobs by project', {
      projectId: req.params.projectId,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/jobs/:jobId/retry
 * Retry a failed job
 */
router.post('/:jobId/retry', auth, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get job from database
    const dbResult = await pool.query(
      'SELECT * FROM automation_jobs WHERE job_id = $1',
      [jobId]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const dbJob = dbResult.rows[0];

    if (dbJob.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Only failed jobs can be retried'
      });
    }

    // Create new job with same data
    const jobResult = await jobQueue.addAutomationJob({
      project_id: dbJob.project_id,
      defect_data: dbJob.metadata?.defect_data || {},
      user_id: dbJob.metadata?.user_id,
      upload_id: dbJob.upload_id,
      asbuilt_record_id: dbJob.asbuilt_record_id
    });

    res.json({
      success: true,
      message: 'Job retry queued',
      new_job_id: jobResult.jobId
    });
  } catch (error) {
    logger.error('[JOBS] Error retrying job', {
      jobId: req.params.jobId,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

