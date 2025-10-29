const { Pool } = require('pg');

class HistoricalPatternLearner {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn('⚠️ [HistoricalPatternLearner] DATABASE_URL is missing – pattern learning disabled.');
      this.pool = null;
      return;
    }

    this.pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }

  async learnFromCorrections() {
    if (!this.pool) {
      return [];
    }

    const client = await this.pool.connect();

    try {
      const { rows } = await client.query(`
        SELECT
          aal.import_id,
          aal.predicted_value,
          aal.user_corrected_value,
          aal.domain,
          aal.was_accepted,
          aal.created_at,
          ar.project_id
        FROM ai_accuracy_log aal
        JOIN asbuilt_records ar ON ar.id = aal.import_id
        WHERE aal.created_at > NOW() - INTERVAL '30 days'
      `);

      const patterns = this.groupByField(rows);

      for (const pattern of patterns) {
        await this.updateImportPattern(client, pattern);
      }

      return patterns;
    } catch (error) {
      console.error('❌ [HistoricalPatternLearner] Failed to learn from corrections', error.message);
      return [];
    } finally {
      client.release();
    }
  }

  groupByField(rows = []) {
    const grouped = new Map();

    rows.forEach(row => {
      const predicted = this.safeParse(row.predicted_value) || {};
      const corrected = this.safeParse(row.user_corrected_value) || {};
      const domain = row.domain;
      const projectId = row.project_id;

      Object.keys(corrected).forEach(field => {
        const predictedValue = predicted[field];
        const correctedValue = corrected[field];

        if (predictedValue === correctedValue) {
          return;
        }

        const key = `${projectId}:${domain}:${field}:${correctedValue}`;
        const entry = grouped.get(key) || {
          projectId,
          domain,
          field,
          correctedValue,
          occurrences: 0,
          recentCorrectionAt: row.created_at
        };

        entry.occurrences += 1;
        entry.recentCorrectionAt = entry.recentCorrectionAt && entry.recentCorrectionAt > row.created_at
          ? entry.recentCorrectionAt
          : row.created_at;

        grouped.set(key, entry);
      });
    });

    return Array.from(grouped.values());
  }

  async updateImportPattern(client, pattern) {
    if (!pattern || !client) {
      return;
    }

    const { projectId, domain, field, correctedValue, occurrences, recentCorrectionAt } = pattern;

    try {
      await client.query(
        `
          INSERT INTO import_patterns (
            user_id,
            domain,
            header_mapping,
            success_rate,
            last_used_at,
            corrections
          )
          VALUES (
            NULL,
            $1,
            jsonb_build_object($2, $3),
            NULL,
            NOW(),
            jsonb_build_object(
              $2,
              jsonb_build_object(
                'value', $3,
                'occurrences', $4,
                'recentCorrectionAt', $5
              )
            )
          )
          ON CONFLICT (user_id, domain)
          DO UPDATE SET
            header_mapping = COALESCE(import_patterns.header_mapping, '{}'::jsonb) || jsonb_build_object($2, $3),
            last_used_at = NOW(),
            corrections = COALESCE(import_patterns.corrections, '{}'::jsonb) || jsonb_build_object(
              $2,
              jsonb_build_object(
                'value', $3,
                'occurrences', $4,
                'recentCorrectionAt', $5
              )
            )
        `,
        [domain, field, correctedValue, occurrences, recentCorrectionAt]
      );
    } catch (error) {
      console.error('❌ [HistoricalPatternLearner] Failed to update import pattern', error.message);
    }
  }

  safeParse(payload) {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'object') {
      return payload;
    }

    try {
      return JSON.parse(payload);
    } catch (error) {
      console.warn('⚠️ [HistoricalPatternLearner] Unable to parse payload', error.message);
      return null;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

module.exports = HistoricalPatternLearner;
