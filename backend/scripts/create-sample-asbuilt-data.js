const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createSampleAsbuiltData() {
  try {
    console.log('🔧 Creating sample as-built data...');
    
    // Sample project ID (use the one from your project)
    const projectId = '69fc302b-166d-4543-9990-89c4b1e0ed59';
    
    // Sample as-built records
    const sampleRecords = [
      {
        project_id: projectId,
        panel_id: 'panel-1',
        domain: 'panel_placement',
        source_doc_id: null,
        raw_data: {
          dateTime: '2025-08-26T10:00:00Z',
          panelNumber: '1',
          location: 'North Section',
          operator: 'John Smith',
          notes: 'Panel placed according to specifications'
        },
        mapped_data: {
          dateTime: '2025-08-26T10:00:00Z',
          panelNumber: '1',
          location: 'North Section',
          operator: 'John Smith',
          notes: 'Panel placed according to specifications'
        },
        ai_confidence: 0.95,
        requires_review: false,
        created_by: '00000000-0000-0000-0000-000000000000' // Placeholder UUID
      },
      {
        project_id: projectId,
        panel_id: 'panel-1',
        domain: 'panel_seaming',
        source_doc_id: null,
        raw_data: {
          dateTime: '2025-08-26T11:00:00Z',
          panelNumbers: '1-2',
          seamerInitials: 'JS',
          weldTemperature: '450°F',
          passFail: 'Pass'
        },
        mapped_data: {
          dateTime: '2025-08-26T11:00:00Z',
          panelNumbers: '1-2',
          seamerInitials: 'JS',
          weldTemperature: '450°F',
          passFail: 'Pass'
        },
        ai_confidence: 0.92,
        requires_review: false,
        created_by: '00000000-0000-0000-0000-000000000000'
      },
      {
        project_id: projectId,
        panel_id: 'panel-2',
        domain: 'panel_placement',
        source_doc_id: null,
        raw_data: {
          dateTime: '2025-08-26T12:00:00Z',
          panelNumber: '2',
          location: 'South Section',
          operator: 'Jane Doe',
          notes: 'Panel 2 placed with proper alignment'
        },
        mapped_data: {
          dateTime: '2025-08-26T12:00:00Z',
          panelNumber: '2',
          location: 'South Section',
          operator: 'Jane Doe',
          notes: 'Panel 2 placed with proper alignment'
        },
        ai_confidence: 0.98,
        requires_review: false,
        created_by: '00000000-0000-0000-0000-000000000000'
      }
    ];
    
    // Insert sample records
    for (const record of sampleRecords) {
      const query = `
        INSERT INTO asbuilt_records (
          project_id, panel_id, domain, source_doc_id,
          raw_data, mapped_data, ai_confidence,
          requires_review, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
      
      const values = [
        record.project_id,
        record.panel_id,
        record.domain,
        record.source_doc_id,
        JSON.stringify(record.raw_data),
        JSON.stringify(record.mapped_data),
        record.ai_confidence,
        record.requires_review,
        record.created_by
      ];
      
      const result = await pool.query(query, values);
      console.log(`✅ Created record: ${record.domain} for panel ${record.panel_id} (ID: ${result.rows[0].id})`);
    }
    
    // Verify the data was created
    const countResult = await pool.query('SELECT COUNT(*) FROM asbuilt_records');
    console.log(`\n📊 Total as-built records: ${countResult.rows[0].count}`);
    
    const projectCount = await pool.query(
      'SELECT COUNT(*) FROM asbuilt_records WHERE project_id = $1',
      [projectId]
    );
    console.log(`📊 Records for project ${projectId}: ${projectCount.rows[0].count}`);
    
    console.log('\n🎉 Sample as-built data created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await pool.end();
  }
}

createSampleAsbuiltData();
