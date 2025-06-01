require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const { WebSocketServer } = require('ws');
const { setupWebSocketServer } = require('./services/websocket');

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// DISABLED - Dashboard redirect causing infinite loop
// app.get('/dashboard', (req, res) => {
//   // Since the web preview accesses port 8000, redirect to Gateway Server on port 5000
//   const gatewayUrl = `${req.protocol}://${req.hostname}:5000/dashboard`;
//   res.redirect(gatewayUrl);
// });

// Redirect root to Gateway Server as well
app.get('/', (req, res) => {
  const gatewayUrl = `${req.protocol}://${req.hostname}:5000/`;
  res.redirect(gatewayUrl);
});

// Setup API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/panels', require('./routes/panels'));
app.use('/api/qc-data', require('./routes/qc-data'));
app.use('/api/payments', require('./routes/payments'));
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
    // Start HTTP server on port 8000
    const PORT = process.env.PORT || 8000;
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