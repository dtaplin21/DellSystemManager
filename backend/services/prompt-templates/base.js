const { Pool } = require('pg');

function formatWithContext(template = '', context = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = context[key];
    if (value === undefined || value === null) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        console.warn('⚠️ [PromptTemplate] Failed to stringify context value', {
          key,
          error: error.message
        });
        return '';
      }
    }

    return String(value);
  });
}

function createPromptTemplate(definition) {
  return {
    ...definition,
    buildMessages(context = {}) {
      const system = formatWithContext(definition.systemTemplate || '', context).trim();
      const user = formatWithContext(definition.userTemplate || '', context).trim();
      const messages = [];

      if (system) {
        messages.push({ role: 'system', content: system });
      }
      if (user) {
        messages.push({ role: 'user', content: user });
      }

      return {
        id: definition.id,
        version: definition.version,
        messages
      };
    }
  };
}

class PromptVersionManager {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn('⚠️ [PromptVersionManager] DATABASE_URL is not configured – prompt usage will not be persisted.');
      this.pool = null;
      return;
    }

    this.pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }

  async trackUsage(promptId, version, success, corrections = null, metadata = {}) {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.query(
        `
          INSERT INTO prompt_performance (
            prompt_id,
            version,
            success,
            user_corrections,
            metadata,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW())
        `,
        [promptId, version, success, corrections ? JSON.stringify(corrections) : null, JSON.stringify(metadata)]
      );
    } catch (error) {
      console.error('❌ [PromptVersionManager] Failed to track prompt usage', {
        promptId,
        version,
        error: error.message
      });
    }
  }

  async getBestVersion(promptId) {
    if (!this.pool) {
      return null;
    }

    try {
      const result = await this.pool.query(
        `
          SELECT version, AVG(success::int) AS success_rate, COUNT(*) AS usage_count
          FROM prompt_performance
          WHERE prompt_id = $1
          GROUP BY version
          ORDER BY success_rate DESC NULLS LAST, usage_count DESC
          LIMIT 1
        `,
        [promptId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ [PromptVersionManager] Failed to fetch best version', {
        promptId,
        error: error.message
      });
      return null;
    }
  }

  async compareVersions(promptId) {
    if (!this.pool) {
      return [];
    }

    try {
      const result = await this.pool.query(
        `
          SELECT
            version,
            AVG(success::int) AS success_rate,
            AVG((user_corrections::jsonb->>'count')::int) AS avg_corrections,
            COUNT(*) AS usage_count
          FROM prompt_performance
          WHERE prompt_id = $1
          GROUP BY version
          ORDER BY success_rate DESC NULLS LAST
        `,
        [promptId]
      );

      return result.rows;
    } catch (error) {
      console.error('❌ [PromptVersionManager] Failed to compare prompt versions', {
        promptId,
        error: error.message
      });
      return [];
    }
  }

  async close() {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
  }
}

module.exports = {
  PromptVersionManager,
  createPromptTemplate,
  formatWithContext
};
