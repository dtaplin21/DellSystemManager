const { Pool } = require('pg');

class ModelMonitor {
  constructor(options = {}) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn('⚠️ [ModelMonitor] DATABASE_URL missing – model monitoring disabled.');
      this.pool = null;
    } else {
      this.pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
      });
    }

    this.intervalMs = options.intervalMs || 7 * 24 * 60 * 60 * 1000; // weekly
    this.intervalHandle = null;
  }

  start() {
    if (!this.pool || this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(async () => {
      await this.checkModelDrift();
      await this.generateReport();
    }, this.intervalMs);

    // Run immediately on start
    this.checkModelDrift().catch(error => {
      console.error('❌ [ModelMonitor] Initial drift check failed', error.message);
    });
    this.generateReport().catch(error => {
      console.error('❌ [ModelMonitor] Initial report generation failed', error.message);
    });
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async checkModelDrift() {
    if (!this.pool) {
      return;
    }

    try {
      const { rows } = await this.pool.query(`
        SELECT
          m.id as model_id,
          m.name,
          m.baseline_accuracy,
          m.status,
          AVG(CASE WHEN p.was_correct THEN 1 ELSE 0 END) AS accuracy,
          COUNT(p.id) AS predictions
        FROM ml_models m
        LEFT JOIN ml_predictions p ON p.model_id = m.id
          AND p.created_at > NOW() - INTERVAL '7 days'
        WHERE m.status = 'active'
        GROUP BY m.id, m.name, m.baseline_accuracy, m.status
      `);

      for (const model of rows) {
        if (!model.baseline_accuracy || !model.predictions) {
          continue;
        }

        const drift = parseFloat(model.baseline_accuracy) - parseFloat(model.accuracy || 0);
        if (drift > 0.1) {
          console.warn(`⚠️ [ModelMonitor] Model ${model.name} drift detected (Δ ${drift.toFixed(2)})`);
          await this.triggerRetrain(model.model_id, {
            baseline: parseFloat(model.baseline_accuracy),
            accuracy: parseFloat(model.accuracy || 0),
            predictions: Number(model.predictions)
          });
        }
      }
    } catch (error) {
      console.error('❌ [ModelMonitor] Drift check failed', error.message);
    }
  }

  async triggerRetrain(modelId, metadata = {}) {
    if (!this.pool) {
      return;
    }

    console.log('📬 [ModelMonitor] Queueing retrain request', { modelId, metadata });

    try {
      await this.pool.query(
        `
          INSERT INTO ml_audit_log (model_id, action, data_snapshot, result, created_at)
          VALUES ($1, 'retrain_requested', $2, $3, NOW())
        `,
        [modelId, JSON.stringify(metadata), JSON.stringify({ status: 'queued' })]
      );
    } catch (error) {
      console.error('❌ [ModelMonitor] Failed to log retrain request', error.message);
    }
  }

  async generateReport() {
    if (!this.pool) {
      return;
    }

    try {
      const [models, accuracyTrends, predictionCounts, anomalies] = await Promise.all([
        this.getAllModels(),
        this.getAccuracyTrends(),
        this.getPredictionCounts(),
        this.getAnomalySummary()
      ]);

      const report = {
        generatedAt: new Date().toISOString(),
        models,
        accuracyTrends,
        predictionCounts,
        anomalies
      };

      await this.sendReportToAdmin(report);
    } catch (error) {
      console.error('❌ [ModelMonitor] Report generation failed', error.message);
    }
  }

  async getAllModels() {
    if (!this.pool) {
      return [];
    }

    try {
      const { rows } = await this.pool.query(`
        SELECT id, name, version, model_type, baseline_accuracy, accuracy, status
        FROM ml_models
        ORDER BY created_at DESC NULLS LAST
      `);
      return rows;
    } catch (error) {
      console.error('❌ [ModelMonitor] Failed to fetch models', error.message);
      return [];
    }
  }

  async getAccuracyTrends() {
    if (!this.pool) {
      return [];
    }

    try {
      const { rows } = await this.pool.query(`
        SELECT
          model_id,
          DATE_TRUNC('day', created_at) as day,
          AVG(CASE WHEN was_correct THEN 1 ELSE 0 END) AS accuracy
        FROM ml_predictions
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY model_id, day
        ORDER BY day DESC
      `);
      return rows;
    } catch (error) {
      console.error('❌ [ModelMonitor] Failed to fetch accuracy trends', error.message);
      return [];
    }
  }

  async getPredictionCounts() {
    if (!this.pool) {
      return [];
    }

    try {
      const { rows } = await this.pool.query(`
        SELECT model_id, COUNT(*) AS predictions
        FROM ml_predictions
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY model_id
      `);
      return rows;
    } catch (error) {
      console.error('❌ [ModelMonitor] Failed to fetch prediction counts', error.message);
      return [];
    }
  }

  async getAnomalySummary() {
    if (!this.pool) {
      return [];
    }

    try {
      const { rows } = await this.pool.query(`
        SELECT
          input_data->>'panelNumber' AS panel_number,
          prediction->>'is_anomaly' AS is_anomaly,
          prediction->>'anomaly_score' AS anomaly_score,
          created_at
        FROM ml_predictions
        WHERE prediction ? 'is_anomaly'
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 50
      `);
      return rows;
    } catch (error) {
      console.error('❌ [ModelMonitor] Failed to fetch anomaly summary', error.message);
      return [];
    }
  }

  async sendReportToAdmin(report) {
    console.log('📈 [ModelMonitor] Weekly ML health report', JSON.stringify(report, null, 2));
  }
}

module.exports = ModelMonitor;
