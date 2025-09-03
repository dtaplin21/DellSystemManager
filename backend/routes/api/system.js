const express = require('express');
const router = express.Router();
const { isOpenAIConfigured } = require('../../services/ai-connector');

/**
 * @route GET /api/system/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * @route GET /api/system/db-test
 * @desc Comprehensive database connection test
 * @access Public
 */
router.get('/db-test', async (req, res) => {
  const testResults = {
    timestamp: new Date().toISOString(),
    environment: {},
    connection: {},
    queries: {},
    errors: []
  };

  try {
    // Phase 1: Environment Variables Check
    console.log('🔍 [DB-TEST] Phase 1: Environment Variables Check');
    testResults.environment = {
      DATABASE_URL: {
        exists: !!process.env.DATABASE_URL,
        startsWith: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'N/A',
        length: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0
      },
      SUPABASE_URL: {
        exists: !!process.env.SUPABASE_URL,
        value: process.env.SUPABASE_URL ? 'Present' : 'Missing'
      },
      SUPABASE_KEY: {
        exists: !!process.env.SUPABASE_KEY,
        value: process.env.SUPABASE_KEY ? 'Present' : 'Missing'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        value: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing'
      }
    };

    // Phase 2: Database Import Test
    console.log('🔍 [DB-TEST] Phase 2: Database Import Test');
    let db, pool, supabase;
    try {
      const dbModule = require('../../db');
      db = dbModule.db;
      pool = dbModule.pool;
      supabase = dbModule.supabase;
      testResults.connection.import = { status: 'success', message: 'Database module imported successfully' };
    } catch (importError) {
      testResults.connection.import = { 
        status: 'error', 
        message: 'Failed to import database module',
        error: importError.message,
        stack: importError.stack
      };
      testResults.errors.push(`Import failed: ${importError.message}`);
      return res.status(500).json(testResults);
    }

    // Phase 3: Connection Pool Test
    console.log('🔍 [DB-TEST] Phase 3: Connection Pool Test');
    try {
      const client = await pool.connect();
      testResults.connection.pool = { 
        status: 'success', 
        message: 'Successfully acquired connection from pool',
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
      
      // Phase 4: Basic Query Test
      console.log('🔍 [DB-TEST] Phase 4: Basic Query Test');
      const basicQuery = await client.query('SELECT NOW() as current_time, version() as db_version');
      testResults.queries.basic = {
        status: 'success',
        currentTime: basicQuery.rows[0].current_time,
        version: basicQuery.rows[0].db_version.substring(0, 50) + '...'
      };

      // Phase 5: Schema Test
      console.log('🔍 [DB-TEST] Phase 5: Schema Test');
      const schemaQuery = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name IN ('projects', 'panel_layouts', 'asbuilt_records')
        ORDER BY table_name, ordinal_position
      `);
      testResults.queries.schema = {
        status: 'success',
        tables: schemaQuery.rows.reduce((acc, row) => {
          if (!acc[row.table_name]) acc[row.table_name] = [];
          acc[row.table_name].push({
            column: row.column_name,
            type: row.data_type
          });
          return acc;
        }, {})
      };

      // Phase 6: Drizzle ORM Test
      console.log('🔍 [DB-TEST] Phase 6: Drizzle ORM Test');
      try {
        // Test a simple Drizzle query
        const drizzleResult = await db.execute('SELECT COUNT(*) as count FROM projects');
        testResults.queries.drizzle = {
          status: 'success',
          message: 'Drizzle ORM query executed successfully',
          result: drizzleResult.rows[0]
        };
      } catch (drizzleError) {
        testResults.queries.drizzle = {
          status: 'error',
          message: 'Drizzle ORM query failed',
          error: drizzleError.message,
          stack: drizzleError.stack
        };
        testResults.errors.push(`Drizzle query failed: ${drizzleError.message}`);
      }

      client.release();
    } catch (connectionError) {
      testResults.connection.pool = {
        status: 'error',
        message: 'Failed to connect to database',
        error: connectionError.message,
        code: connectionError.code,
        stack: connectionError.stack
      };
      testResults.errors.push(`Connection failed: ${connectionError.message}`);
    }

    // Phase 7: Supabase Client Test
    console.log('🔍 [DB-TEST] Phase 7: Supabase Client Test');
    try {
      const { data, error } = await supabase.from('projects').select('count').limit(1);
      if (error) {
        testResults.connection.supabase = {
          status: 'error',
          message: 'Supabase query failed',
          error: error.message,
          code: error.code
        };
        testResults.errors.push(`Supabase query failed: ${error.message}`);
      } else {
        testResults.connection.supabase = {
          status: 'success',
          message: 'Supabase client working correctly'
        };
      }
    } catch (supabaseError) {
      testResults.connection.supabase = {
        status: 'error',
        message: 'Supabase client failed',
        error: supabaseError.message,
        stack: supabaseError.stack
      };
      testResults.errors.push(`Supabase client failed: ${supabaseError.message}`);
    }

    // Final Status
    testResults.overall = {
      status: testResults.errors.length === 0 ? 'success' : 'partial',
      errorCount: testResults.errors.length,
      message: testResults.errors.length === 0 
        ? 'All database tests passed successfully' 
        : `${testResults.errors.length} error(s) found`
    };

    console.log('🔍 [DB-TEST] Test completed:', testResults.overall);
    res.json(testResults);

  } catch (error) {
    console.error('🔍 [DB-TEST] Unexpected error:', error);
    testResults.errors.push(`Unexpected error: ${error.message}`);
    testResults.overall = {
      status: 'error',
      errorCount: testResults.errors.length,
      message: 'Database test failed with unexpected error'
    };
    res.status(500).json(testResults);
  }
});

/**
 * @route GET /api/system/services
 * @desc Get system services status
 * @access Public
 */
router.get('/services', async (req, res) => {
  try {
    // Check which services are available
    const services = {
      ai: {
        openai: isOpenAIConfigured(),
      },
      payment: {
        stripe: !!process.env.STRIPE_SECRET_KEY,
      },
      auth: {
        firebase: !!(process.env.VITE_FIREBASE_API_KEY && 
                     process.env.VITE_FIREBASE_PROJECT_ID && 
                     process.env.VITE_FIREBASE_APP_ID),
      }
    };

    // Create a list of missing services that might be needed
    const missingSecrets = [];
    
    if (!services.ai.openai) {
      missingSecrets.push('ai.openai');
    }
    
    if (!services.payment.stripe) {
      missingSecrets.push('payment.stripe');
    }
    
    if (!services.auth.firebase) {
      missingSecrets.push('auth.firebase');
    }

    res.json({
      services,
      missingSecrets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting service status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

module.exports = router;