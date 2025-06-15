const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { WebSocketServer } = require('ws');
const { setupWebSocketServer } = require('./services/websocket');
const { runMigrations } = require('./db/migrate');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use('/api/handwriting', require('./routes/handwriting'));
app.use('/api/system', require('./routes/api/system'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Database connection
const { connectToDatabase, applyMigrations } = require('./db');

// Check for OpenAI API configuration
const { isOpenAIConfigured, initAIServices } = require('./services/ai-connector');

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
    // Run migrations
    await runMigrations();
    
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