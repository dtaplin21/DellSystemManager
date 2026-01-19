const logger = require('../lib/logger');
const { pool } = require('../db');

/**
 * Cost Monitoring Service
 * Tracks AI service costs and sends alerts when thresholds are exceeded
 */
class CostMonitor {
  constructor() {
    // Cost thresholds (in USD)
    this.thresholds = {
      daily: parseFloat(process.env.COST_THRESHOLD_DAILY || '50.00'),
      weekly: parseFloat(process.env.COST_THRESHOLD_WEEKLY || '300.00'),
      monthly: parseFloat(process.env.COST_THRESHOLD_MONTHLY || '1000.00'),
      perUserDaily: parseFloat(process.env.COST_THRESHOLD_PER_USER_DAILY || '10.00'),
      perRequest: parseFloat(process.env.COST_THRESHOLD_PER_REQUEST || '1.00'),
    };
    
    // Alert recipients (comma-separated emails)
    this.alertEmails = process.env.COST_ALERT_EMAILS?.split(',') || [];
    
    // Alert cooldown (minutes) - prevent spam
    this.alertCooldown = parseInt(process.env.COST_ALERT_COOLDOWN || '60', 10);
    
    // Last alert timestamps
    this.lastAlerts = new Map();
  }
  
  /**
   * Track a cost event
   * @param {Object} event - Cost event data
   * @param {string} event.userId - User ID
   * @param {string} event.model - AI model used
   * @param {number} event.cost - Cost in USD
   * @param {number} event.tokens - Number of tokens
   * @param {string} event.endpoint - API endpoint
   */
  async trackCost(event) {
    const { userId, model, cost, tokens, endpoint } = event;
    
    try {
      // Log cost event
      logger.info('[CostMonitor] Cost event tracked', {
        userId,
        model,
        cost,
        tokens,
        endpoint,
        timestamp: new Date().toISOString()
      });
      
      // Store in database (if telemetry table exists)
      await this._storeCostEvent(event);
      
      // Check thresholds
      await this._checkThresholds(event);
      
    } catch (error) {
      logger.error('[CostMonitor] Error tracking cost', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Store cost event in database
   */
  async _storeCostEvent(event) {
    try {
      // Check if telemetry table exists
      const client = await pool.connect();
      try {
        await client.query(`
          INSERT INTO telemetry_events (
            user_id, event_type, event_data, created_at
          ) VALUES ($1, $2, $3, NOW())
          ON CONFLICT DO NOTHING
        `, [
          event.userId,
          'ai_cost',
          JSON.stringify({
            model: event.model,
            cost: event.cost,
            tokens: event.tokens,
            endpoint: event.endpoint
          })
        ]);
      } finally {
        client.release();
      }
    } catch (error) {
      // Table might not exist, log and continue
      logger.debug('[CostMonitor] Could not store cost event in database', {
        error: error.message
      });
    }
  }
  
  /**
   * Check if cost thresholds are exceeded
   */
  async _checkThresholds(event) {
    const { userId, cost } = event;
    const now = Date.now();
    
    // Check per-request threshold
    if (cost > this.thresholds.perRequest) {
      await this._sendAlert('per_request', {
        userId,
        cost,
        threshold: this.thresholds.perRequest,
        message: `Single request cost ($${cost.toFixed(2)}) exceeded per-request threshold ($${this.thresholds.perRequest.toFixed(2)})`
      });
    }
    
    // Check daily totals (async, don't block)
    this._checkDailyTotals(userId, cost).catch(err => {
      logger.error('[CostMonitor] Error checking daily totals', { error: err.message });
    });
  }
  
  /**
   * Check daily cost totals
   */
  async _checkDailyTotals(userId, cost) {
    try {
      const client = await pool.connect();
      try {
        // Get today's total for user
        const userDailyResult = await client.query(`
          SELECT COALESCE(SUM((event_data->>'cost')::numeric), 0) as total_cost
          FROM telemetry_events
          WHERE user_id = $1
            AND event_type = 'ai_cost'
            AND created_at >= CURRENT_DATE
        `, [userId]);
        
        const userDailyTotal = parseFloat(userDailyResult.rows[0]?.total_cost || 0) + cost;
        
        if (userDailyTotal > this.thresholds.perUserDaily) {
          await this._sendAlert('per_user_daily', {
            userId,
            cost: userDailyTotal,
            threshold: this.thresholds.perUserDaily,
            message: `User ${userId} daily cost ($${userDailyTotal.toFixed(2)}) exceeded threshold ($${this.thresholds.perUserDaily.toFixed(2)})`
          });
        }
        
        // Get today's total for all users
        const globalDailyResult = await client.query(`
          SELECT COALESCE(SUM((event_data->>'cost')::numeric), 0) as total_cost
          FROM telemetry_events
          WHERE event_type = 'ai_cost'
            AND created_at >= CURRENT_DATE
        `);
        
        const globalDailyTotal = parseFloat(globalDailyResult.rows[0]?.total_cost || 0) + cost;
        
        if (globalDailyTotal > this.thresholds.daily) {
          await this._sendAlert('daily', {
            cost: globalDailyTotal,
            threshold: this.thresholds.daily,
            message: `Daily cost ($${globalDailyTotal.toFixed(2)}) exceeded threshold ($${this.thresholds.daily.toFixed(2)})`
          });
        }
        
      } finally {
        client.release();
      }
    } catch (error) {
      logger.debug('[CostMonitor] Could not check daily totals', {
        error: error.message
      });
    }
  }
  
  /**
   * Send alert (with cooldown to prevent spam)
   */
  async _sendAlert(type, data) {
    const alertKey = `${type}_${data.userId || 'global'}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    const now = Date.now();
    
    // Check cooldown
    if (lastAlert && (now - lastAlert) < this.alertCooldown * 60 * 1000) {
      logger.debug('[CostMonitor] Alert suppressed due to cooldown', {
        type,
        alertKey,
        lastAlert: new Date(lastAlert).toISOString()
      });
      return;
    }
    
    // Update last alert timestamp
    this.lastAlerts.set(alertKey, now);
    
    // Log alert
    logger.warn('[CostMonitor] Cost threshold exceeded', {
      type,
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Send email alerts (if configured)
    if (this.alertEmails.length > 0) {
      await this._sendEmailAlert(type, data);
    }
    
    // TODO: Send to monitoring service (Sentry, Datadog, etc.)
    // TODO: Send Slack/Discord webhook notification
  }
  
  /**
   * Send email alert
   */
  async _sendEmailAlert(type, data) {
    // TODO: Implement email sending
    // For now, just log
    logger.info('[CostMonitor] Email alert would be sent', {
      type,
      recipients: this.alertEmails,
      data
    });
  }
  
  /**
   * Get cost statistics
   */
  async getCostStats(period = 'day', userId = null) {
    try {
      const client = await pool.connect();
      try {
        let query = `
          SELECT 
            COUNT(*) as request_count,
            COALESCE(SUM((event_data->>'cost')::numeric), 0) as total_cost,
            COALESCE(AVG((event_data->>'cost')::numeric), 0) as avg_cost,
            COALESCE(MAX((event_data->>'cost')::numeric), 0) as max_cost
          FROM telemetry_events
          WHERE event_type = 'ai_cost'
        `;
        
        const params = [];
        
        // Add period filter
        if (period === 'day') {
          query += ' AND created_at >= CURRENT_DATE';
        } else if (period === 'week') {
          query += ' AND created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === 'month') {
          query += ' AND created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }
        
        // Add user filter
        if (userId) {
          query += ' AND user_id = $1';
          params.push(userId);
        }
        
        const result = await client.query(query, params);
        return result.rows[0];
        
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('[CostMonitor] Error getting cost stats', {
        error: error.message
      });
      return null;
    }
  }
}

// Singleton instance
let costMonitorInstance = null;

function getCostMonitor() {
  if (!costMonitorInstance) {
    costMonitorInstance = new CostMonitor();
  }
  return costMonitorInstance;
}

module.exports = {
  CostMonitor,
  getCostMonitor
};

