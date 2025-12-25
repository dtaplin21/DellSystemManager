const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class AsbuiltService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Create a new as-built record
   */
  async createRecord(recordData) {
    const client = await this.pool.connect();
    try {
      const {
        projectId,
        panelId,
        domain,
        sourceDocId,
        rawData,
        mappedData,
        aiConfidence,
        requiresReview,
        createdBy,
        source = 'import', // Default to 'import', can be 'mobile', 'web', or 'import'
        locationDescription, // Combined formatted string
        placementType, // Structured: "single_panel" or "seam"
        locationDistance, // Structured: distance in feet
        locationDirection // Structured: "north", "south", "east", "west"
      } = recordData;

      // Generate locationDescription from structured fields if not provided
      let finalLocationDescription = locationDescription;
      if (!finalLocationDescription && placementType && locationDistance && locationDirection) {
        const panelNumbers = mappedData?.panelNumbers || mappedData?.panelNumber || panelId || '';
        const distance = Math.round(locationDistance);
        const direction = locationDirection.charAt(0).toUpperCase() + locationDirection.slice(1).toLowerCase();
        
        if (placementType === 'seam' || placementType === 'Seam Between Panels') {
          // Parse panel numbers for seam
          const panels = panelNumbers.split(',').map(p => p.trim()).filter(p => p);
          if (panels.length >= 2) {
            finalLocationDescription = `${distance} feet ${direction} along seam between ${panels[0]} and ${panels[1]}`;
          } else {
            finalLocationDescription = `${distance} feet ${direction} along seam between panels`;
          }
        } else {
          finalLocationDescription = `${distance} feet ${direction} from ${panelNumbers}`;
        }
      }

      // Normalize placementType: "Single Panel" -> "single_panel", "Seam Between Panels" -> "seam"
      let normalizedPlacementType = null;
      if (placementType) {
        if (placementType === 'Single Panel' || placementType === 'single_panel') {
          normalizedPlacementType = 'single_panel';
        } else if (placementType === 'Seam Between Panels' || placementType === 'seam') {
          normalizedPlacementType = 'seam';
        } else {
          normalizedPlacementType = placementType.toLowerCase().replace(/\s+/g, '_');
        }
      }

      // Normalize locationDirection: "North" -> "north"
      let normalizedDirection = null;
      if (locationDirection) {
        normalizedDirection = locationDirection.toLowerCase();
      }

      const query = `
        INSERT INTO asbuilt_records (
          id, project_id, panel_id, domain, source_doc_id, 
          raw_data, mapped_data, ai_confidence, requires_review, created_by, source, status, 
          location_description, placement_type, location_distance, location_direction
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const values = [
        uuidv4(),
        projectId,
        panelId,
        domain,
        sourceDocId,
        JSON.stringify(rawData),
        JSON.stringify(mappedData),
        aiConfidence,
        requiresReview || false,
        createdBy,
        source,
        'pending', // New forms start as pending
        finalLocationDescription || null,
        normalizedPlacementType,
        locationDistance || null,
        normalizedDirection
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Find existing record matching project, panel, domain, and raw_data payload.
   */
  async findRecordByRawData({ projectId, panelId, domain, rawData }) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT id
        FROM asbuilt_records
        WHERE project_id = $1
          AND panel_id = $2
          AND domain = $3
          AND raw_data = $4::jsonb
        LIMIT 1
      `;

      const values = [projectId, panelId, domain, rawData];
      const result = await client.query(query, values);
      return result.rows[0] ?? null;
    } finally {
      client.release();
    }
  }

  /**
   * Get all records for a specific panel
   */
  async getPanelRecords(projectId, panelId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM asbuilt_records 
        WHERE project_id = $1 AND panel_id = $2
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [projectId, panelId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get records by domain
   */
  async getRecordsByDomain(projectId, domain) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM asbuilt_records 
        WHERE project_id = $1 AND domain = $2
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [projectId, domain]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get project summary statistics
   */
  async getProjectSummary(projectId) {
    const client = await this.pool.connect();
    try {
      // Get domain statistics
      const domainQuery = `
        SELECT 
          domain,
          COUNT(*) as record_count,
          AVG(ai_confidence) as avg_confidence,
          COUNT(CASE WHEN requires_review = true THEN 1 END) as review_count
        FROM asbuilt_records 
        WHERE project_id = $1
        GROUP BY domain
        ORDER BY domain
      `;
      
      const domainResult = await client.query(domainQuery, [projectId]);
      
      // Get overall statistics
      const totalQuery = `
        SELECT 
          COUNT(*) as total_records,
          AVG(ai_confidence) as avg_confidence,
          COUNT(CASE WHEN requires_review = true THEN 1 END) as review_required
        FROM asbuilt_records 
        WHERE project_id = $1
      `;
      
      const totalResult = await client.query(totalQuery, [projectId]);
      const totalStats = totalResult.rows[0];
      
      // Build domain counts object
      const domainCounts = {};
      domainResult.rows.forEach(row => {
        domainCounts[row.domain] = parseInt(row.record_count);
      });
      
      return {
        totalRecords: parseInt(totalStats.total_records) || 0,
        averageConfidence: parseFloat(totalStats.avg_confidence) || 0,
        reviewRequired: parseInt(totalStats.review_required) || 0,
        domainCounts: domainCounts,
        recordsByDomain: domainResult.rows
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get all records for a project
   */
  async getProjectRecords(projectId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM asbuilt_records 
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [projectId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Update a record
   */
  async updateRecord(recordId, updateData) {
    const client = await this.pool.connect();
    try {
      const {
        mappedData,
        aiConfidence,
        requiresReview
      } = updateData;

      const query = `
        UPDATE asbuilt_records 
        SET 
          mapped_data = $1,
          ai_confidence = $2,
          requires_review = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;

      const values = [
        JSON.stringify(mappedData),
        aiConfidence,
        requiresReview,
        recordId
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(recordId) {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM asbuilt_records WHERE id = $1 RETURNING *';
      const result = await client.query(query, [recordId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get all records for a project
   */
  async getProjectRecords(projectId, limit = 100, offset = 0) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM asbuilt_records 
        WHERE project_id = $1
        ORDER BY 
          CASE 
            WHEN mapped_data->>'panelNumber' ~ '^[0-9]+$' 
            THEN (mapped_data->>'panelNumber')::integer 
            ELSE 999999 
          END ASC,
          created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await client.query(query, [projectId, limit, offset]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get a single as-built record by ID
   */
  async getRecordById(recordId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM asbuilt_records 
        WHERE id = $1
      `;
      
      const result = await client.query(query, [recordId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const record = result.rows[0];
      
      // Parse JSON fields (they come as strings from PostgreSQL)
      record.raw_data = typeof record.raw_data === 'string' ? JSON.parse(record.raw_data) : record.raw_data;
      record.mapped_data = typeof record.mapped_data === 'string' ? JSON.parse(record.mapped_data) : record.mapped_data;
      
      return record;
    } catch (error) {
      console.error('Error fetching record by ID:', error);
      throw error;
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
}

module.exports = AsbuiltService;
