const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { WebSocketServer } = require('ws');
const config = require('./config/env');
const logger = require('./lib/logger');
const { setupWebSocketServer } = require('./services/websocket');
const { connectToDatabase, applyMigrations, pool } = require('./db');
const { isOpenAIConfigured, initAIServices } = require('./services/ai-connector');
const ModelMonitor = require('./services/mlMonitor');

const SERVICE_NAME = 'GeoSynth QC Pro Backend';
const SERVICE_VERSION = '1.0.0';

// Initialize Express app
const app = express();
app.disable('x-powered-by');

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-dev-bypass']
}));

const httpLoggingStream = {
  write: (message) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    if (config.isProduction) {
      logger.info('HTTP request', { message: trimmed });
      return;
    }

    logger.debug('HTTP request', { message: trimmed });
  }
};

app.use(config.isProduction ? morgan('combined', { stream: httpLoggingStream }) : morgan('dev', { stream: httpLoggingStream }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Backend server should not handle root requests - only API routes
// Root requests should go directly to gateway server on port 5000

// API health check endpoint - must be before other API routes
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT 1 as test');
    client.release();
    
    res.status(200).json({ 
      status: 'OK', 
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: SERVICE_VERSION,
      database: 'connected'
    });
  } catch (error) {
    logger.error('API health check failed', {
      error: {
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    res.status(500).json({ 
      status: 'unhealthy',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: SERVICE_VERSION,
      database: 'disconnected',
      error: error.message
    });
  }
});

// Setup API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/telemetry', require('./routes/telemetry'));
app.use('/api/panels', require('./routes/panels'));
app.use('/api/qc-data', require('./routes/qc-data'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai-automation', require('./routes/ai-automation'));
app.use('/api/mobile', require('./routes/mobile'));
app.use('/api/panel-layout', require('./routes/panelLayout'));
app.use('/api/panel-requirements', require('./routes/panelRequirements'));
app.use('/api/handwriting', require('./routes/handwriting'));
app.use('/api/system', require('./routes/api/system'));
app.use('/api/connected-workflow', require('./routes/connected-workflow'));
app.use('/api/asbuilt', require('./routes/asbuilt'));
app.use('/api/document-processing', require('./routes/documentProcessing'));
logger.debug('Routes registered', {
  routes: [
    '/api/connected-workflow',
    '/api/asbuilt',
    '/api/document-processing'
  ]
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled application error', {
    path: req.path,
    method: req.method,
    error: {
      name: err.name,
      code: err.code,
      status: err.status,
      message: err.message,
      stack: config.isDevelopment ? err.stack : undefined
    }
  });
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: config.isDevelopment ? err.message : undefined
  });
});

// Health check endpoint - moved here after pool import
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT 1 as test');
    client.release();
    
    res.status(200).json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: {
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// Global error handlers for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error
      ? { message: reason.message, stack: config.isDevelopment ? reason.stack : undefined }
      : reason,
    promise
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: {
      message: error.message,
      stack: error.stack
    }
  });
  // Gracefully shutdown the server
  process.exit(1);
});

// Start the server
async function startServer() {
  // Check environment configuration
  if (!config.secrets.firebaseApiKey) {
    logger.warn('Firebase credentials are missing. Google authentication will not be available.');
  }
  
  if (!config.secrets.stripe) {
    logger.warn('STRIPE_SECRET_KEY is not set. Stripe functionality will not work.');
  }
  
  if (!config.secrets.jwt) {
    logger.warn('JWT_SECRET is not provided. Tokens will not be signed securely.');
  }
  
  try {
    // Start HTTP server on port 8003 (avoiding conflicts with gateway on 8000 and panel service on 8001)
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on http://0.0.0.0:${config.port}`);
    });
    
    // Initialize WebSocket server - only once
    if (!global.wsServer) {
      const wss = new WebSocketServer({ server, path: '/ws' });
      setupWebSocketServer(wss);
      global.wsServer = wss;
      logger.info('WebSocket server initialized');
    }
    
    // Initialize AI services if OpenAI API key is available
    let aiServiceAvailable = false;
    let openaiServiceAvailable = false;

    try {
      await initAIServices();
      aiServiceAvailable = true;
      openaiServiceAvailable = isOpenAIConfigured();
      
      if (!openaiServiceAvailable) {
        logger.warn('OpenAI API key not configured. AI features may be limited.');
      }
    } catch (error) {
      logger.warn('AI service initialisation failed. AI analysis features may be unavailable.', {
        error: {
          message: error.message,
          stack: config.isDevelopment ? error.stack : undefined
        }
      });
    }
    
    logger.info('AI services status', { aiServiceAvailable, openaiServiceAvailable });
    
    // Connect to database
    try {
      await connectToDatabase();
      logger.info('Connected to PostgreSQL database');
      
      // Apply database migrations
      await applyMigrations();

      if (!global.mlMonitor) {
        const mlMonitor = new ModelMonitor();
        mlMonitor.start();
        global.mlMonitor = mlMonitor;
        logger.info('Model monitor initialized');
      }
    } catch (dbError) {
      logger.error('Database connection failed', {
        error: {
          message: dbError.message,
          stack: config.isDevelopment ? dbError.stack : undefined
        }
      });
    }
  } catch (error) {
    logger.error('Failed to start server', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    process.exit(1);
  }
}

// Export only what's needed
module.exports = app;

// Start server only if this is the main module
if (require.main === module) {
  startServer();
}
