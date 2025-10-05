const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seedTestData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting database seeding...');
    
    // Create test user
    const testUserId = uuidv4();
    const testUserEmail = 'dev@example.com';
    
    // Get existing user or create new one
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [testUserEmail]);
    const finalUserId = existingUser.rows.length > 0 ? existingUser.rows[0].id : testUserId;
    
    if (existingUser.rows.length === 0) {
      await client.query(`
        INSERT INTO users (id, email, display_name, company, subscription, is_admin, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [testUserId, testUserEmail, 'Development User', 'Development Company', 'premium', true]);
    }
    
    console.log('✅ Test user created/updated');
    
    // Create test projects
    const testProjects = [
      {
        id: uuidv4(),
        name: 'Geosynthetic Installation Project Alpha',
        description: 'Large-scale geosynthetic installation for environmental protection',
        location: 'California, USA',
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Landfill Liner System Beta',
        description: 'Comprehensive landfill liner system with multiple layers',
        location: 'Texas, USA',
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Mining Containment Project Gamma',
        description: 'Mining waste containment and water management system',
        location: 'Nevada, USA',
        status: 'planning'
      }
    ];
    
    for (const project of testProjects) {
      await client.query(`
        INSERT INTO projects (id, user_id, name, description, location, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [project.id, finalUserId, project.name, project.description, project.location, project.status]);
      
      console.log(`✅ Project created: ${project.name}`);
    }
    
    // Create test as-built records
    const projectId = testProjects[0].id; // Use first project
    
    const testAsbuiltRecords = [
      {
        id: uuidv4(),
        project_id: projectId,
        panel_id: uuidv4(),
        domain: 'panel_placement',
        source_doc_id: null,
        raw_data: JSON.stringify({
          'panel number': 'P-001',
          'location': 'A1',
          'date': '2025-01-15',
          'coordinates': '37.7749, -122.4194'
        }),
        mapped_data: JSON.stringify({
          panelNumber: 'P-001',
          location: 'A1',
          date: '2025-01-15',
          coordinates: '37.7749, -122.4194'
        }),
        ai_confidence: 0.92,
        requires_review: false,
        created_by: finalUserId
      },
      {
        id: uuidv4(),
        project_id: projectId,
        panel_id: uuidv4(),
        domain: 'panel_seaming',
        source_doc_id: null,
        raw_data: JSON.stringify({
          'panel number': 'P-002',
          'seam type': 'hot wedge',
          'temperature': '180°C',
          'operator': 'John Smith'
        }),
        mapped_data: JSON.stringify({
          panelNumber: 'P-002',
          seamType: 'hot wedge',
          temperature: '180°C',
          operator: 'John Smith'
        }),
        ai_confidence: 0.88,
        requires_review: false,
        created_by: finalUserId
      },
      {
        id: uuidv4(),
        project_id: projectId,
        panel_id: uuidv4(),
        domain: 'non_destructive',
        source_doc_id: null,
        raw_data: JSON.stringify({
          'panel number': 'P-003',
          'test type': 'ultrasonic',
          'result': 'pass',
          'inspector': 'Jane Doe'
        }),
        mapped_data: JSON.stringify({
          panelNumber: 'P-003',
          testType: 'ultrasonic',
          result: 'pass',
          inspector: 'Jane Doe'
        }),
        ai_confidence: 0.75,
        requires_review: true,
        created_by: finalUserId
      }
    ];
    
    for (const record of testAsbuiltRecords) {
      await client.query(`
        INSERT INTO asbuilt_records (
          id, project_id, panel_id, domain, source_doc_id, 
          raw_data, mapped_data, ai_confidence, requires_review, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          raw_data = EXCLUDED.raw_data,
          mapped_data = EXCLUDED.mapped_data,
          ai_confidence = EXCLUDED.ai_confidence,
          requires_review = EXCLUDED.requires_review,
          updated_at = NOW()
      `, [
        record.id, record.project_id, record.panel_id, record.domain, record.source_doc_id,
        record.raw_data, record.mapped_data, record.ai_confidence, record.requires_review, record.created_by
      ]);
      
      console.log(`✅ As-built record created: ${record.domain} for panel ${record.panel_id}`);
    }
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - 1 test user (${testUserEmail})`);
    console.log(`   - ${testProjects.length} test projects`);
    console.log(`   - ${testAsbuiltRecords.length} test as-built records`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('✅ Seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTestData };
