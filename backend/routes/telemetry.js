/**
 * Telemetry API Routes
 * Handles error tracking, performance metrics, cost tracking, and analytics
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { pool } = require('../db');

/**
 * POST /api/telemetry/cost
 * Track cost/usage metrics
 */
router.post('/cost', async (req, res) => {
  try {
    const { costs } = req.body;

    if (!Array.isArray(costs) || costs.length === 0) {
      return res.status(400).json({ error: 'Invalid cost data' });
    }

    // Store cost metrics in database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const cost of costs) {
        await client.query(
          `INSERT INTO cost_metrics 
           (user_id, user_tier, service, model, cost, tokens, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT DO NOTHING`,
          [
            cost.userId,
            cost.userTier,
            cost.service,
            cost.model || null,
            cost.cost,
            cost.tokens || null,
            cost.metadata ? JSON.stringify(cost.metadata) : null,
          ]
        );
      }

      await client.query('COMMIT');
      logger.info(`[Telemetry] Stored ${costs.length} cost metrics`);
    } finally {
      client.release();
    }

    res.json({ success: true, count: costs.length });
  } catch (error) {
    logger.error('[Telemetry] Error storing cost metrics:', error);
    res.status(500).json({ error: 'Failed to store cost metrics' });
  }
});

/**
 * POST /api/telemetry/analytics
 * Track user events and analytics
 */
router.post('/analytics', async (req, res) => {
  try {
    const { event, properties, timestamp, environment } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event name required' });
    }

    // Store analytics event
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO analytics_events 
         (event_name, properties, environment, created_at)
         VALUES ($1, $2, $3, COALESCE(to_timestamp($4 / 1000), NOW()))`,
        [
          event,
          properties ? JSON.stringify(properties) : null,
          environment || 'production',
        ]
      );
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Telemetry] Error storing analytics event:', error);
    res.status(500).json({ error: 'Failed to store analytics event' });
  }
});

/**
 * POST /api/telemetry/errors
 * Track errors from frontend
 */
router.post('/errors', async (req, res) => {
  try {
    const { errors } = req.body;

    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ error: 'Invalid error data' });
    }

    // Store errors in database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const errorData of errors) {
        await client.query(
          `INSERT INTO error_logs 
           (error_message, error_stack, error_name, context, environment, user_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE(to_timestamp($7 / 1000), NOW()))`,
          [
            errorData.message,
            errorData.stack,
            errorData.name,
            errorData.context ? JSON.stringify(errorData.context) : null,
            errorData.environment || 'production',
            errorData.context?.userId || null,
          ]
        );
      }

      await client.query('COMMIT');
      logger.info(`[Telemetry] Stored ${errors.length} errors`);
    } finally {
      client.release();
    }

    res.json({ success: true, count: errors.length });
  } catch (error) {
    logger.error('[Telemetry] Error storing error logs:', error);
    res.status(500).json({ error: 'Failed to store error logs' });
  }
});

/**
 * GET /api/telemetry/cost/summary
 * Get cost summary for a user or time period
 */
router.get('/cost/summary', async (req, res) => {
  try {
    const { userId, userTier, startDate, endDate } = req.query;

    let query = `
      SELECT 
        user_id,
        user_tier,
        service,
        model,
        SUM(cost) as total_cost,
        SUM(tokens) as total_tokens,
        COUNT(*) as request_count
      FROM cost_metrics
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (userTier) {
      query += ` AND user_tier = $${paramIndex++}`;
      params.push(userTier);
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += `
      GROUP BY user_id, user_tier, service, model
      ORDER BY total_cost DESC
      LIMIT 100
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Telemetry] Error fetching cost summary:', error);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

/**
 * GET /api/telemetry/errors/summary
 * Get error summary
 */
router.get('/errors/summary', async (req, res) => {
  try {
    const { startDate, endDate, environment } = req.query;

    let query = `
      SELECT 
        error_name,
        COUNT(*) as error_count,
        MAX(created_at) as last_occurrence
      FROM error_logs
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (environment) {
      query += ` AND environment = $${paramIndex++}`;
      params.push(environment);
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += `
      GROUP BY error_name
      ORDER BY error_count DESC
      LIMIT 50
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Telemetry] Error fetching error summary:', error);
    res.status(500).json({ error: 'Failed to fetch error summary' });
  }
});

module.exports = router;

