const AsbuiltService = require('./asbuiltService');
const formAutomationService = require('./formAutomationService');
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

      // Check if automation_jobs table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'automation_jobs'
        )
      `);
      const hasAutomationJobsTable = tableCheck.rows[0]?.exists || false;

      // Determine table alias/prefix based on whether we're joining
      const tablePrefix = hasAutomationJobsTable ? 'ar.' : '';

      // Add source filter (only if column exists)
      if (source && hasSourceColumn) {
        paramCount++;
        query += ` AND ${tablePrefix}source = $${paramCount}`;
        params.push(source);
      } else if (source && !hasSourceColumn) {
        // If source column doesn't exist, return empty array with a note
        console.warn('⚠️ [FORMS] source column does not exist. Please run migration 006_add_form_review_columns.sql');
        return [];
      }

      // Add status filter (only if column exists)
      if (status && status !== 'all' && hasStatusColumn) {
        paramCount++;
        query += ` AND ${tablePrefix}status = $${paramCount}`;
        params.push(status);
      }

      // Add domain filter
      if (domain && domain !== 'all') {
        paramCount++;
        query += ` AND ${tablePrefix}domain = $${paramCount}`;
        params.push(domain);
      }

      // Add search filter
      if (search) {
        paramCount++;
        query += ` AND (
          ${tablePrefix}mapped_data::text ILIKE $${paramCount} OR
          ${tablePrefix}raw_data::text ILIKE $${paramCount}
        )`;
        params.push(`%${search}%`);
      }

      // Join with automation_jobs if table exists
      if (hasAutomationJobsTable) {
        query = query.replace(
          'SELECT * FROM asbuilt_records',
          `SELECT 
            ar.*,
            aj.job_id as automation_job_id,
            aj.status as automation_status,
            aj.progress as automation_progress,
            aj.result as automation_result,
            aj.error_message as automation_error_message,
            aj.created_at as automation_created_at,
            aj.started_at as automation_started_at,
            aj.completed_at as automation_completed_at
          FROM asbuilt_records ar
          LEFT JOIN automation_jobs aj ON ar.id = aj.asbuilt_record_id`
        );
        // Update WHERE clause to use alias
        query = query.replace('WHERE project_id = $1', 'WHERE ar.project_id = $1');
      }

      query += ` ORDER BY ${tablePrefix}created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await client.query(query, params);
      
      // Parse JSON fields and structure automation job data
      return result.rows.map(row => {
        const form = {
          ...row,
          raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
          mapped_data: typeof row.mapped_data === 'string' ? JSON.parse(row.mapped_data) : row.mapped_data,
          // Set defaults if columns don't exist
          source: row.source || 'import',
          status: row.status || 'pending'
        };

        // Add automation job data if available
        if (row.automation_job_id) {
          form.automation_job = {
            job_id: row.automation_job_id,
            status: row.automation_status || 'queued',
            progress: row.automation_progress || 0,
            result: typeof row.automation_result === 'string' 
              ? JSON.parse(row.automation_result) 
              : row.automation_result,
            error_message: row.automation_error_message,
            created_at: row.automation_created_at,
            started_at: row.automation_started_at,
            completed_at: row.automation_completed_at
          };
        }

        // Remove automation fields from top level
        delete form.automation_job_id;
        delete form.automation_status;
        delete form.automation_progress;
        delete form.automation_result;
        delete form.automation_error_message;
        delete form.automation_created_at;
        delete form.automation_started_at;
        delete form.automation_completed_at;

        return form;
      });
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

      // Check if automation_jobs table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'automation_jobs'
        )
      `);
      const hasAutomationJobsTable = tableCheck.rows[0]?.exists || false;

      // Determine table alias/prefix based on whether we're joining
      const tableAlias = hasAutomationJobsTable ? 'ar' : 'asbuilt_records';

      let query = `
        SELECT 
          COUNT(*) as total
      `;
      
      if (hasStatusColumn) {
        query += `,
          COUNT(*) FILTER (WHERE ${tableAlias}.status = 'pending') as pending,
          COUNT(*) FILTER (WHERE ${tableAlias}.status = 'approved') as approved,
          COUNT(*) FILTER (WHERE ${tableAlias}.status = 'rejected') as rejected
        `;
      } else {
        query += `,
          0 as pending,
          0 as approved,
          0 as rejected
        `;
      }

      // Add automation job statistics if table exists
      if (hasAutomationJobsTable) {
        query += `,
          COUNT(DISTINCT aj.id) FILTER (WHERE aj.status = 'processing' OR aj.status = 'queued') as automation_processing,
          COUNT(DISTINCT aj.id) FILTER (WHERE aj.status = 'completed') as automation_completed,
          COUNT(DISTINCT aj.id) FILTER (WHERE aj.status = 'failed') as automation_failed
        `;
      } else {
        query += `,
          0 as automation_processing,
          0 as automation_completed,
          0 as automation_failed
        `;
      }
      
      query += `,
          COUNT(*) FILTER (WHERE ${tableAlias}.domain = 'panel_placement') as panel_placement,
          COUNT(*) FILTER (WHERE ${tableAlias}.domain = 'repairs') as repairs,
          COUNT(*) FILTER (WHERE ${tableAlias}.domain = 'panel_seaming') as panel_seaming,
          COUNT(*) FILTER (WHERE ${tableAlias}.domain = 'non_destructive') as non_destructive,
          COUNT(*) FILTER (WHERE ${tableAlias}.domain = 'trial_weld') as trial_weld,
          COUNT(*) FILTER (WHERE ${tableAlias}.domain = 'destructive') as destructive
        FROM ${hasAutomationJobsTable ? 'asbuilt_records ar LEFT JOIN automation_jobs aj ON ar.id = aj.asbuilt_record_id' : 'asbuilt_records'}
        WHERE ${tableAlias}.project_id = $1
      `;
      
      const params = [projectId];
      
      if (hasSourceColumn) {
        query += ` AND ${tableAlias}.source = $2`;
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
      const approvedForm = {
        ...row,
        raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
        mapped_data: typeof row.mapped_data === 'string' ? JSON.parse(row.mapped_data) : row.mapped_data
      };

      // After approval, check if automation should be triggered
      // Run asynchronously - don't block approval response
      setImmediate(async () => {
        try {
          const projectId = approvedForm.project_id;
          const domain = approvedForm.domain;
          
          console.log(`[FORM_REVIEW] Starting automation check for form ${recordId}`, {
            formId: recordId,
            userId,
            projectId,
            domain,
            status: approvedForm.status
          });
          
          // Check if automation is enabled
          const isEnabled = await formAutomationService.isAutoCreateEnabled(userId, projectId);
          
          console.log(`[FORM_REVIEW] Automation enabled check result:`, {
            formId: recordId,
            isEnabled,
            userId,
            projectId
          });
          
          if (!isEnabled) {
            console.log(`[FORM_REVIEW] Auto-creation disabled, skipping automation for form ${recordId}`, {
              formId: recordId,
              userId,
              projectId
            });
            return;
          }
          
          console.log(`[FORM_REVIEW] Auto-creation enabled, checking form requirements for form ${recordId}`);
          
          // Check if form has required location data (for repair/destructive forms)
          if (domain === 'repairs' || domain === 'destructive') {
            const hasRequiredData = formAutomationService.hasRequiredLocationData(approvedForm);
            
            console.log(`[FORM_REVIEW] Required location data check for form ${recordId}`, {
              formId: recordId,
              domain,
              hasRequiredData,
              mappedData: approvedForm.mapped_data
            });
            
            if (!hasRequiredData) {
              console.log(`[FORM_REVIEW] Skipping automation - form ${recordId} missing required location data`, {
                formId: recordId,
                domain,
                reason: 'Missing structured location fields (placementType, locationDistance, locationDirection, panelNumbers)',
                mappedData: approvedForm.mapped_data
              });
              return; // Don't proceed with automation
            }
          }
          
          console.log(`[FORM_REVIEW] Triggering automation for form ${recordId}`, {
            formId: recordId,
            projectId,
            userId,
            domain
          });
          
          const automationResult = await formAutomationService.automateFromForm(
            approvedForm,
            projectId,
            userId
          );
          
          console.log(`[FORM_REVIEW] Automation result for form ${recordId}:`, {
            formId: recordId,
            success: automationResult.success,
            skipped: automationResult.skipped,
            error: automationResult.error,
            reason: automationResult.reason,
            jobId: automationResult.jobId,
            itemType: automationResult.itemType
          });
        } catch (error) {
          // Log error but don't fail approval
          console.error(`[FORM_REVIEW] Error triggering automation after approval for form ${recordId}:`, {
            formId: recordId,
            error: error.message,
            stack: error.stack,
            userId,
            projectId: approvedForm?.project_id
          });
        }
      });

      return approvedForm;
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
      const approvedRecordIds = result.rows.map(r => r.id);
      
      // After bulk approval, trigger automation for each approved form
      // Run asynchronously - don't block approval response
      setImmediate(async () => {
        try {
          // Fetch full form records for automation
          const fetchQuery = `
            SELECT * FROM asbuilt_records
            WHERE id = ANY($1::uuid[])
          `;
          const fetchResult = await client.query(fetchQuery, [approvedRecordIds]);
          
          const automationJobs = [];
          for (const row of fetchResult.rows) {
            try {
              const formRecord = {
                ...row,
                raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data,
                mapped_data: typeof row.mapped_data === 'string' ? JSON.parse(row.mapped_data) : row.mapped_data
              };
              
              const projectId = formRecord.project_id;
              const isEnabled = await formAutomationService.isAutoCreateEnabled(userId, projectId);
              
              if (isEnabled) {
                const automationResult = await formAutomationService.automateFromForm(
                  formRecord,
                  projectId,
                  userId
                );
                automationJobs.push({
                  formId: formRecord.id,
                  ...automationResult
                });
              }
            } catch (error) {
              console.error(`[FORM_REVIEW] Error automating form ${row.id}:`, error);
            }
          }
          
          console.log(`[FORM_REVIEW] Bulk automation completed: ${automationJobs.length} jobs created`);
        } catch (error) {
          console.error(`[FORM_REVIEW] Error triggering bulk automation:`, error);
        }
      });
      
      return {
        approved: result.rows.length,
        recordIds: approvedRecordIds
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

