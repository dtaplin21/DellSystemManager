const AsbuiltService = require('./asbuiltService');
const { Pool } = require('pg');
require('dotenv').config();

class FormReviewService {
  constructor() {
    this.asbuiltService = new AsbuiltService();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Get forms for a project with pagination and filters
   */
  async getForms(projectId, options = {}) {
    const {
      status,
      source = 'mobile', // Default to mobile app forms
      domain,
      limit = 50,
      offset = 0,
      search
    } = options;

    const client = await this.pool.connect();
    try {
      // First check if the new columns exist
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'asbuilt_records' 
        AND column_name IN ('source', 'status')
      `);
      
      const hasSourceColumn = columnCheck.rows.some(r => r.column_name === 'source');
      const hasStatusColumn = columnCheck.rows.some(r => r.column_name === 'status');

      let query = `
        SELECT * FROM asbuilt_records 
        WHERE project_id = $1
      `;
      const params = [projectId];
      let paramCount = 1;

      // Add source filter (only if column exists)
      if (source && hasSourceColumn) {
        paramCount++;
        query += ` AND source = $${paramCount}`;
        params.push(source);
      } else if (source && !hasSourceColumn) {
        // If source column doesn't exist, return empty array with a note
        console.warn('⚠️ [FORMS] source column does not exist. Please run migration 006_add_form_review_columns.sql');
        return [];
      }

      // Add status filter (only if column exists)
      if (status && status !== 'all' && hasStatusColumn) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status);
      }

      // Add domain filter
      if (domain && domain !== 'all') {
        paramCount++;
        query += ` AND domain = $${paramCount}`;
        params.push(domain);
      }

      // Add search filter
      if (search) {
        paramCount++;
        query += ` AND (
          mapped_data::text ILIKE $${paramCount} OR
          raw_data::text ILIKE $${paramCount}
        )`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await client.query(query, params);
      
      // Parse JSON fields
      return result.rows.map(row => ({
        ...row,
        raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
        mapped_data: typeof row.mapped_data === 'string' ? JSON.parse(row.mapped_data) : row.mapped_data,
        // Set defaults if columns don't exist
        source: row.source || 'import',
        status: row.status || 'pending'
      }));
    } catch (error) {
      console.error('❌ [FORMS] Error in getForms:', error);
      console.error('❌ [FORMS] Error details:', {
        code: error.code,
        message: error.message,
        detail: error.detail,
        hint: error.hint
      });
      throw new Error(`Database query failed: ${error.message}. ${error.hint || ''} Please ensure migration 006_add_form_review_columns.sql has been run.`);
    } finally {
      client.release();
    }
  }

  /**
   * Get form statistics for a project
   */
  async getFormStats(projectId, source = 'mobile') {
    const client = await this.pool.connect();
    try {
      // Check if columns exist
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'asbuilt_records' 
        AND column_name IN ('source', 'status')
      `);
      
      const hasSourceColumn = columnCheck.rows.some(r => r.column_name === 'source');
      const hasStatusColumn = columnCheck.rows.some(r => r.column_name === 'status');

      let query = `
        SELECT 
          COUNT(*) as total
      `;
      
      if (hasStatusColumn) {
        query += `,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected
        `;
      } else {
        query += `,
          0 as pending,
          0 as approved,
          0 as rejected
        `;
      }
      
      query += `,
          COUNT(*) FILTER (WHERE domain = 'panel_placement') as panel_placement,
          COUNT(*) FILTER (WHERE domain = 'repairs') as repairs,
          COUNT(*) FILTER (WHERE domain = 'panel_seaming') as panel_seaming,
          COUNT(*) FILTER (WHERE domain = 'non_destructive') as non_destructive,
          COUNT(*) FILTER (WHERE domain = 'trial_weld') as trial_weld,
          COUNT(*) FILTER (WHERE domain = 'destructive') as destructive
        FROM asbuilt_records
        WHERE project_id = $1
      `;
      
      const params = [projectId];
      
      if (hasSourceColumn) {
        query += ` AND source = $2`;
        params.push(source);
      }

      const result = await client.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('❌ [FORMS] Error in getFormStats:', error);
      console.error('❌ [FORMS] Error details:', {
        code: error.code,
        message: error.message,
        detail: error.detail,
        hint: error.hint
      });
      throw new Error(`Database query failed: ${error.message}. ${error.hint || ''} Please ensure migration 006_add_form_review_columns.sql has been run.`);
    } finally {
      client.release();
    }
  }

  /**
   * Approve a form
   */
  async approveForm(recordId, userId, notes = null) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE asbuilt_records
        SET 
          status = 'approved',
          approved_by = $1,
          approved_at = NOW(),
          review_notes = COALESCE($2, review_notes),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await client.query(query, [userId, notes, recordId]);
      if (result.rows.length === 0) {
        throw new Error('Form not found');
      }

      const row = result.rows[0];
      return {
        ...row,
        raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
        mapped_data: typeof row.mapped_data === 'string' ? JSON.parse(row.mapped_data) : row.mapped_data
      };
    } finally {
      client.release();
    }
  }

  /**
   * Reject a form
   */
  async rejectForm(recordId, userId, reason, notes = null) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE asbuilt_records
        SET 
          status = 'rejected',
          approved_by = $1,
          approved_at = NOW(),
          rejection_reason = $2,
          review_notes = COALESCE($3, review_notes),
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;

      const result = await client.query(query, [userId, reason, notes, recordId]);
      if (result.rows.length === 0) {
        throw new Error('Form not found');
      }

      const row = result.rows[0];
      return {
        ...row,
        raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
        mapped_data: typeof row.mapped_data === 'string' ? JSON.parse(row.mapped_data) : row.mapped_data
      };
    } finally {
      client.release();
    }
  }

  /**
   * Bulk approve forms
   */
  async bulkApprove(recordIds, userId, notes = null) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE asbuilt_records
        SET 
          status = 'approved',
          approved_by = $1,
          approved_at = NOW(),
          review_notes = COALESCE($2, review_notes),
          updated_at = NOW()
        WHERE id = ANY($3::uuid[])
        RETURNING id, status
      `;

      const result = await client.query(query, [userId, notes, recordIds]);
      return {
        approved: result.rows.length,
        recordIds: result.rows.map(r => r.id)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Bulk reject forms
   */
  async bulkReject(recordIds, userId, reason, notes = null) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE asbuilt_records
        SET 
          status = 'rejected',
          approved_by = $1,
          approved_at = NOW(),
          rejection_reason = $2,
          review_notes = COALESCE($3, review_notes),
          updated_at = NOW()
        WHERE id = ANY($4::uuid[])
        RETURNING id, status
      `;

      const result = await client.query(query, [userId, reason, notes, recordIds]);
      return {
        rejected: result.rows.length,
        recordIds: result.rows.map(r => r.id)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get pending forms count
   */
  async getPendingCount(projectId, source = 'mobile') {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM asbuilt_records
        WHERE project_id = $1 AND source = $2 AND status = 'pending'
      `;

      const result = await client.query(query, [projectId, source]);
      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }
}

module.exports = new FormReviewService();

