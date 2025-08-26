const { Pool } = require('pg');
require('dotenv').config();

class AsbuiltService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  /**
   * Create a new asbuilt record
   */
  async createRecord(recordData) {
    const {
      projectId,
      panelId,
      domain,
      sourceDocId,
      rawData,
      mappedData,
      aiConfidence,
      requiresReview,
      createdBy
    } = recordData;

    const query = `
      INSERT INTO asbuilt_records (
        project_id, panel_id, domain, source_doc_id, 
        raw_data, mapped_data, ai_confidence, 
        requires_review, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      projectId, panelId, domain, sourceDocId,
      rawData, mappedData, aiConfidence,
      requiresReview, createdBy
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating asbuilt record:', error);
      throw new Error(`Failed to create asbuilt record: ${error.message}`);
    }
  }

  /**
   * Get all records for a specific panel across all domains
   */
  async getPanelRecords(projectId, panelId) {
    console.log('🔍 [SERVICE] getPanelRecords called with:', { projectId, panelId });
    
    // Check database connection health first
    try {
      await this.pool.query('SELECT 1 as health_check');
    } catch (dbError) {
      console.error('❌ [SERVICE] Database connection failed:', dbError.message);
      throw new Error(`Database connection failed: ${dbError.message}`);
    }
    
    // First check if the table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'asbuilt_records'
      );
    `;
    
    try {
      const tableExists = await this.pool.query(tableCheckQuery);
      console.log('🔍 [SERVICE] Table exists check:', tableExists.rows[0]);
      
      if (!tableExists.rows[0]?.exists) {
        console.error('❌ [SERVICE] asbuilt_records table does not exist!');
        throw new Error('asbuilt_records table does not exist in database');
      }
      
      const query = `
        SELECT * FROM asbuilt_records 
        WHERE project_id = $1 AND panel_id = $2
        ORDER BY domain, created_at DESC
      `;

      console.log('🔍 [SERVICE] Executing query:', query);
      console.log('🔍 [SERVICE] Query parameters:', [projectId, panelId]);
      
      const result = await this.pool.query(query, [projectId, panelId]);
      console.log('✅ [SERVICE] Query successful, rows returned:', result.rows.length);
      
      return result.rows;
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching panel records:', error);
      console.error('❌ [SERVICE] Error stack:', error.stack);
      throw new Error(`Failed to fetch panel records: ${error.message}`);
    }
  }

  /**
   * Get records for a specific domain and panel
   */
  async getDomainRecords(projectId, panelId, domain) {
    const query = `
      SELECT * FROM asbuilt_records 
      WHERE project_id = $1 AND panel_id = $2 AND domain = $3
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId, panelId, domain]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching domain records:', error);
      throw new Error(`Failed to fetch domain records: ${error.message}`);
    }
  }

  /**
   * Update an existing record
   */
  async updateRecord(recordId, updateData) {
    const { mappedData, requiresReview } = updateData;
    
    const query = `
      UPDATE asbuilt_records 
      SET mapped_data = $1, requires_review = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [mappedData, requiresReview, recordId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating asbuilt record:', error);
      throw new Error(`Failed to update asbuilt record: ${error.message}`);
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(recordId) {
    const query = `DELETE FROM asbuilt_records WHERE id = $1 RETURNING *`;

    try {
      const result = await this.pool.query(query, [recordId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting asbuilt record:', error);
      throw new Error(`Failed to delete asbuilt record: ${error.message}`);
    }
  }

  /**
   * Get records requiring review
   */
  async getRecordsRequiringReview(projectId) {
    const query = `
      SELECT * FROM asbuilt_records 
      WHERE project_id = $1 AND requires_review = true
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [projectId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching records requiring review:', error);
      throw new Error(`Failed to fetch records requiring review: ${error.message}`);
    }
  }

  /**
   * Approve a record (remove review flag)
   */
  async approveRecord(recordId) {
    const query = `
      UPDATE asbuilt_records 
      SET requires_review = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [recordId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error approving asbuilt record:', error);
      throw new Error(`Failed to approve asbuilt record: ${error.message}`);
    }
  }

  /**
   * Get panel summary with record counts
   */
  async getPanelSummary(projectId, panelId) {
    const query = `
      SELECT 
        domain,
        COUNT(*) as record_count,
        MAX(created_at) as last_updated
      FROM asbuilt_records 
      WHERE project_id = $1 AND panel_id = $2
      GROUP BY domain
      ORDER BY domain
    `;

    try {
      const result = await this.pool.query(query, [projectId, panelId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching panel summary:', error);
      throw new Error(`Failed to fetch panel summary: ${error.message}`);
    }
  }

  /**
   * Find right neighbor panel for peek
   */
  async findRightNeighbor(projectId, panelId) {
    try {
      // This would need to integrate with the panel layout system
      // For now, return null - will be implemented in PanelLayout integration
      return null;
    } catch (error) {
      console.error('Error in findRightNeighbor:', error);
      // Return null instead of throwing to prevent crashes
      return null;
    }
  }

  /**
   * Bulk insert records (for Excel import)
   */
  async bulkInsertRecords(records) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const insertedRecords = [];
      for (const record of records) {
        const result = await client.query(`
          INSERT INTO asbuilt_records (
            project_id, panel_id, domain, source_doc_id,
            raw_data, mapped_data, ai_confidence,
            requires_review, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          record.projectId, record.panelId, record.domain,
          record.sourceDocId, record.rawData, record.mappedData,
          record.aiConfidence, record.requiresReview, record.createdBy
        ]);
        
        insertedRecords.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return insertedRecords;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in bulk insert:', error);
      throw new Error(`Bulk insert failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    await this.pool.end();
  }

  /**
   * Check if project exists in projects table
   */
  async checkProjectExists(projectId) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM projects 
          WHERE id = $1
        );
      `;
      const result = await this.pool.query(query, [projectId]);
      return result.rows[0]?.exists || false;
    } catch (error) {
      console.error('Error checking project existence:', error);
      return false;
    }
  }

  /**
   * Check if panel exists in panel_layouts table
   */
  async checkPanelExists(projectId, panelId) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM panel_layouts 
          WHERE project_id = $1 
          AND panels @> '[{"panel_number": $2}]'
        );
      `;
      const result = await this.pool.query(query, [projectId, panelId]);
      return result.rows[0]?.exists || false;
    } catch (error) {
      console.error('Error checking panel existence:', error);
      return false;
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabaseConnection() {
    try {
      const result = await this.pool.query('SELECT 1 as test');
      return result.rows[0]?.test === 1;
    } catch (error) {
      console.error('Database connectivity check failed:', error);
      return false;
    }
  }

  /**
   * Get panel information from panel_layouts table
   */
  async getPanelInfo(projectId, panelId) {
    try {
      const query = `
        SELECT 
          pl.id as layout_id,
          p->>'panel_number' as panel_number,
          p->>'roll_number' as roll_number,
          p->>'width_feet' as width_feet,
          p->>'height_feet' as height_feet,
          p->>'x' as x,
          p->>'y' as y
        FROM panel_layouts pl,
        LATERAL jsonb_array_elements(pl.panels) AS p
        WHERE pl.project_id = $1 
        AND p->>'panel_number' = $2
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [projectId, panelId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting panel info:', error);
      return null;
    }
  }
}

module.exports = AsbuiltService;
