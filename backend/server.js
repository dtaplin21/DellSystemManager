const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { WebSocketServer } = require('ws');
const { setupWebSocketServer } = require('./services/websocket');

// Debug environment variables
console.log('Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'exists' : 'missing');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'exists' : 'missing');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'exists' : 'missing');

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Backend server should not handle root requests - only API routes
// Root requests should go directly to gateway server on port 5000

// Setup API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/panels', require('./routes/panels'));
app.use('/api/qc-data', require('./routes/qc-data'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai-automation', require('./routes/ai-automation'));
app.use('/api/panel-layout', require('./routes/panelLayout'));
app.use('/api/panel-requirements', require('./routes/panelRequirements'));
app.use('/api/handwriting', require('./routes/handwriting'));
app.use('/api/system', require('./routes/api/system'));
app.use('/api/connected-workflow', require('./routes/connected-workflow'));
app.use('/api/asbuilt', require('./routes/asbuilt'));
console.log('✅ /api/connected-workflow route registered');
console.log('✅ /api/asbuilt route registered');

// Error handler
app.use((err, req, res, next) => {
  console.error('=== ERROR HANDLER ===');
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Error details:', {
    name: err.name,
    code: err.code,
    status: err.status
  });
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Database connection
const { connectToDatabase, applyMigrations, pool } = require('./db');

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
    console.error('❌ Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check for OpenAI API configuration
const { isOpenAIConfigured, initAIServices } = require('./services/ai-connector');

// Global error handlers for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('Stack:', reason?.stack);
});

process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  // Gracefully shutdown the server
  process.exit(1);
});

// Start the server
async function startServer() {
  // Check environment configuration
  if (!process.env.VITE_FIREBASE_API_KEY) {
    console.log('Firebase credentials are missing. Google authentication will not be available.');
  }
  
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('STRIPE_SECRET_KEY is not set. Stripe functionality will not work.');
  }
  
  if (!process.env.JWT_SECRET) {
    console.log('JWT_SECRET not provided. Using a default secret (this is not secure for production)');
  }
  
  try {
    // Start HTTP server on port 8003 (avoiding conflicts with gateway on 8000 and panel service on 8001)
    const PORT = process.env.PORT || 8003;
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
    
    // Initialize WebSocket server - only once
    if (!global.wsServer) {
      const wss = new WebSocketServer({ server, path: '/ws' });
      setupWebSocketServer(wss);
      global.wsServer = wss;
      console.log('WebSocket server initialized');
    }
    
    // Initialize AI services if OpenAI API key is available
    let aiServiceAvailable = false;
    let openaiServiceAvailable = false;

    try {
      await initAIServices();
      aiServiceAvailable = true;
      openaiServiceAvailable = isOpenAIConfigured();
      
      if (!openaiServiceAvailable) {
        console.log('OpenAI API key not configured. AI features may be limited.');
      }
    } catch (error) {
      console.error('AI Service is not available. AI analysis features will not work.');
      console.error(error);
    }
    
    console.log('AI services status:', { aiServiceAvailable, openaiServiceAvailable });
    
    // Connect to database
    try {
      await connectToDatabase();
      console.log('Connected to PostgreSQL database');
      
      // Apply database migrations
      await applyMigrations();
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export only what's needed
module.exports = app;

// Start server only if this is the main module
if (require.main === module) {
  startServer();
}