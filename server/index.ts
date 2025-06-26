import dotenv from 'dotenv';
import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { WebSocketServer } from 'ws';
import { setupWebSocketServer } from '../backend/services/websocket';
import { connectToDatabase, applyMigrations } from '../backend/db';
import { isOpenAIConfigured, initAIServices } from '../backend/services/ai-connector';

// Load environment variables
dotenv.config();

const app: Express = express();

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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Setup routes
app.use('/api/auth', require('../backend/routes/auth'));
app.use('/api/projects', require('../backend/routes/projects'));
app.use('/api/documents', require('../backend/routes/documents'));
app.use('/api/panels', require('../backend/routes/panels'));
app.use('/api/qc-data', require('../backend/routes/qc-data'));
app.use('/api/payments', require('../backend/routes/payments'));
app.use('/api/system', require('../backend/routes/api/system.js'));

// Serve index.html for all non-API routes
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Add this type declaration
declare global {
  var wsServer: WebSocketServer | undefined;
}

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
    // Start HTTP server
    const PORT = parseInt(process.env.PORT || '8000', 10);
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
    
    // Initialize AI services
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
      await applyMigrations();
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this is the main module
if (require.main === module) {
  startServer();
}

export default app; 