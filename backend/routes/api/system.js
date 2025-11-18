const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { isOpenAIConfigured } = require('../../services/ai-connector');

const orchestratorManifestPath = path.join(
  __dirname,
  '../../..',
  'ai_service',
  'orchestrator_manifest.json'
);

const loadOrchestratorManifest = () => {
  try {
    const raw = fs.readFileSync(orchestratorManifestPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('⚠️ Unable to load orchestrator manifest:', error.message);
    }
    return null;
  }
};

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
    pool: {},
    queries: {},
    diagnostics: {},
    errors: []
  };

  try {
    // Phase 1: Environment Variables Check
    console.log('🔍 [DB-TEST] Phase 1: Environment Variables Check');
    const dbUrl = process.env.DATABASE_URL || '';
    testResults.environment = {
      DATABASE_URL: {
        exists: !!process.env.DATABASE_URL,
        startsWith: dbUrl ? dbUrl.substring(0, 20) + '...' : 'N/A',
        length: dbUrl.length,
        // Parse and mask connection details
        parsed: dbUrl ? (() => {
          try {
            const url = new URL(dbUrl);
            return {
              protocol: url.protocol,
              hostname: url.hostname,
              port: url.port || '5432',
              database: url.pathname.split('/')[1] || 'unknown',
              hasUser: !!url.username,
              hasPassword: !!url.password
            };
          } catch {
            return { format: 'connection_string', valid: false };
          }
        })() : null
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
    let db, pool, supabase, getPoolHealth, testDatabaseConnection;
    try {
      const dbModule = require('../../db');
      db = dbModule.db;
      pool = dbModule.pool;
      supabase = dbModule.supabase;
      getPoolHealth = dbModule.getPoolHealth;
      testDatabaseConnection = dbModule.testDatabaseConnection;
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

    // Phase 2.5: Pool Health Check
    console.log('🔍 [DB-TEST] Phase 2.5: Pool Health Check');
    if (getPoolHealth) {
      testResults.pool = getPoolHealth();
    } else {
      testResults.pool = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
    }

    // Phase 2.6: Quick Connection Test
    console.log('🔍 [DB-TEST] Phase 2.6: Quick Connection Test');
    if (testDatabaseConnection) {
      const connectionTest = await testDatabaseConnection(5000);
      testResults.connection.test = connectionTest;
      if (!connectionTest.success) {
        testResults.errors.push(`Connection test failed: ${connectionTest.error}`);
      }
    }

    // Phase 3: Connection Pool Test
    console.log('🔍 [DB-TEST] Phase 3: Connection Pool Test');
    let client;
    try {
      const connectStartTime = Date.now();
      client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Pool connect timeout after 10 seconds')), 10000)
        )
      ]);
      const connectDuration = Date.now() - connectStartTime;
      
      testResults.connection.pool = { 
        status: 'success', 
        message: 'Successfully acquired connection from pool',
        connectDuration,
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
        host: client.connectionParameters?.host,
        database: client.connectionParameters?.database,
        port: client.connectionParameters?.port
      };
      
      // Phase 4: Basic Query Test
      console.log('🔍 [DB-TEST] Phase 4: Basic Query Test');
      const queryStartTime = Date.now();
      const basicQuery = await Promise.race([
        client.query('SELECT NOW() as current_time, version() as db_version'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
        )
      ]);
      const queryDuration = Date.now() - queryStartTime;
      
      testResults.queries.basic = {
        status: 'success',
        duration: queryDuration,
        currentTime: basicQuery.rows[0].current_time,
        version: basicQuery.rows[0].db_version.substring(0, 50) + '...'
      };

      // Phase 5: Schema Test
      console.log('🔍 [DB-TEST] Phase 5: Schema Test');
      const schemaQuery = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name IN ('projects', 'panel_layouts', 'asbuilt_records', 'users')
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
      
      // Phase 7: Final Diagnostics
      testResults.diagnostics = {
        poolHealth: getPoolHealth ? getPoolHealth() : {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        },
        summary: {
          allTestsPassed: testResults.errors.length === 0,
          totalErrors: testResults.errors.length,
          connectionWorking: testResults.connection.pool?.status === 'success',
          queriesWorking: testResults.queries.basic?.status === 'success'
        }
      };
      
      return res.status(200).json(testResults);
    } catch (connectionError) {
      testResults.connection.pool = {
        status: 'error',
        message: 'Failed to connect to database',
        error: connectionError.message,
        code: connectionError.code,
        stack: connectionError.stack,
        poolState: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        }
      };
      testResults.errors.push(`Connection failed: ${connectionError.message}`);
      
      // Add diagnostics even on failure
      testResults.diagnostics = {
        poolHealth: getPoolHealth ? getPoolHealth() : {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        },
        summary: {
          allTestsPassed: false,
          totalErrors: testResults.errors.length,
          connectionWorking: false,
          queriesWorking: false,
          failureReason: connectionError.message
        }
      };
      
      return res.status(500).json(testResults);
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
        orchestrator: {
          available: false,
          capabilities: {},
          workflows: [],
          generatedAt: null
        },
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

    const orchestratorManifest = loadOrchestratorManifest();
    if (orchestratorManifest?.manifest) {
      services.ai.orchestrator = {
        available: true,
        capabilities: orchestratorManifest.manifest.capabilities || {},
        workflows: orchestratorManifest.manifest.workflows || [],
        generatedAt: orchestratorManifest.generatedAt || null
      };
    }

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