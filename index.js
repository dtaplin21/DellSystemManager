// Simplified Gateway Server for GeoQC platform

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8000;

// Use default Express routing for flexibility with dashboard and API routes

// Basic logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers['user-agent'] ? 'Browser' : 'Curl/Other');
  next();
});

// Set CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    return res.status(200).json({});
  }
  next();
});

// Public directory for static assets (after dashboard routes)
const publicDir = path.join(__dirname, 'public');

// Standard middleware (before API routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser middleware for JWT authentication
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// API auth routes - direct implementation
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        display_name TEXT NOT NULL,
        company TEXT,
        position TEXT,
        subscription TEXT DEFAULT 'basic',
        profile_image_url TEXT,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initDatabase();

// Helper functions
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, subscription: user.subscription },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '7d' }
  );
};

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  console.log('Signup request:', req.body);
  
  try {
    const { name, email, password, company } = req.body;
    
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user in database
    const result = await pool.query(`
      INSERT INTO users (email, password, display_name, company, subscription)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, display_name, company, subscription, created_at, updated_at
    `, [email, hashedPassword, name, company || null, 'basic']);
    
    const newUser = result.rows[0];
    
    // Generate JWT token
    const token = generateToken(newUser);
    
    // Set cookie and also return token for localStorage storage
    setTokenCookie(res, token);
    
    // Return user info and token
    res.status(201).json({ 
      user: newUser,
      token: token,
      success: true
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Something went wrong during signup' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  console.log('Login request:', req.body);
  
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Find user by email in database
    const result = await pool.query(`
      SELECT id, email, password, display_name, company, subscription, created_at, updated_at
      FROM users WHERE email = $1
    `, [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Update last login
    await pool.query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set cookie and also return token for localStorage storage
    setTokenCookie(res, token);
    
    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ 
      user: userWithoutPassword,
      token: token,
      success: true
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Something went wrong during login' });
  }
});

// Token validation middleware
const validateToken = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    
    // Also check Authorization header for localStorage tokens
    if (!token && req.headers?.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // Get user from database
    const result = await pool.query(`
      SELECT id, email, display_name, company, subscription, created_at, updated_at
      FROM users WHERE id = $1
    `, [decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token - user not found' });
    }
    
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Token validation error:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get current user endpoint
app.get('/api/auth/user', validateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

// Projects API endpoints
app.get('/api/projects', validateToken, async (req, res) => {
  try {
    const userProjects = await pool.query(`
      SELECT id, name, description, location, status, created_at, updated_at
      FROM projects WHERE user_id = $1
      ORDER BY updated_at DESC
    `, [req.user.id]);
    
    res.json({ projects: userProjects.rows });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

app.get('/api/projects/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT id, name, description, location, status, created_at, updated_at
      FROM projects WHERE id = $1 AND user_id = $2
    `, [id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Failed to fetch project' });
  }
});

// AI Assistant endpoints
app.post('/api/ai/query', validateToken, async (req, res) => {
  try {
    const { projectId, question, documents } = req.body;
    
    if (!projectId || !question) {
      return res.status(400).json({ message: 'Project ID and question are required' });
    }
    
    // Verify project access
    const projectResult = await pool.query(`
      SELECT id FROM projects WHERE id = $1 AND user_id = $2
    `, [projectId, req.user.id]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Process documents and query with OpenAI
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    let context = '';
    if (documents && documents.length > 0) {
      context = documents.map(doc => `Document: ${doc.filename}\nContent: ${doc.text}`).join('\n\n');
    }
    
    const prompt = `You are an AI assistant for geosynthetic engineering projects. Based on the following documents and question, provide a detailed answer with specific references.
    
Context:
${context}

Question: ${question}

Please provide:
1. A comprehensive answer
2. Specific references to source documents with relevant excerpts

Format your response as JSON with the structure:
{
  "answer": "detailed answer here",
  "references": [
    {
      "docId": "document_id",
      "page": 1,
      "excerpt": "relevant text excerpt"
    }
  ]
}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    
    const aiResponse = JSON.parse(response.choices[0].message.content);
    
    res.json(aiResponse);
  } catch (error) {
    console.error('AI query error:', error);
    res.status(500).json({ message: 'Failed to process AI query' });
  }
});

app.post('/api/ai/automate-layout', validateToken, async (req, res) => {
  try {
    const { projectId, documents } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }
    
    // Verify project access
    const projectResult = await pool.query(`
      SELECT id FROM projects WHERE id = $1 AND user_id = $2
    `, [projectId, req.user.id]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Set job status to processing
    await pool.query(`
      INSERT INTO ai_jobs (id, project_id, user_id, type, status, created_at)
      VALUES (gen_random_uuid(), $1, $2, 'layout_generation', 'processing', NOW())
      ON CONFLICT (project_id, type) DO UPDATE SET
        status = 'processing',
        created_at = NOW()
    `, [projectId, req.user.id]);
    
    // Process documents and generate layout with OpenAI
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    let context = '';
    if (documents && documents.length > 0) {
      context = documents.map(doc => `Document: ${doc.filename}\nContent: ${doc.text}`).join('\n\n');
    }
    
    const prompt = `You are an AI assistant for geosynthetic panel layout optimization. Based on the provided documents, generate an optimal panel layout configuration.
    
Context:
${context}

Generate a panel layout with the following specifications:
- Analyze site dimensions and constraints from documents
- Create rectangular panels with realistic dimensions (10-50 feet width/height)
- Ensure panels don't overlap
- Optimize for coverage and installation efficiency
- Include seam details and welding specifications

Format your response as JSON:
{
  "projectId": "${projectId}",
  "width": 1000,
  "height": 800,
  "scale": 1,
  "panels": [
    {
      "id": "panel_1",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 150,
      "rotation": 0,
      "material": "HDPE",
      "thickness": "1.5mm",
      "seamType": "extrusion_welded",
      "annotations": ["Anchor points required", "Quality control zone"]
    }
  ]
}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    
    const layoutData = JSON.parse(response.choices[0].message.content);
    
    // Update job status to completed
    await pool.query(`
      UPDATE ai_jobs SET status = 'completed', completed_at = NOW()
      WHERE project_id = $1 AND type = 'layout_generation'
    `, [projectId]);
    
    res.json(layoutData);
  } catch (error) {
    console.error('AI layout generation error:', error);
    
    // Update job status to failed
    await pool.query(`
      UPDATE ai_jobs SET status = 'failed', completed_at = NOW()
      WHERE project_id = $1 AND type = 'layout_generation'
    `, [req.body.projectId]);
    
    res.status(500).json({ message: 'Failed to generate layout' });
  }
});

app.get('/api/ai/job-status/:projectId', validateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await pool.query(`
      SELECT status, created_at, completed_at 
      FROM ai_jobs 
      WHERE project_id = $1 AND user_id = $2 AND type = 'layout_generation'
      ORDER BY created_at DESC 
      LIMIT 1
    `, [projectId, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.json({ status: 'idle' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ message: 'Failed to fetch job status' });
  }
});

// Main landing page - serve static HTML (MUST come FIRST before any middlewares)
app.get('/', (req, res) => {
  console.log('=== ROOT ROUTE HIT ===');
  const filePath = path.join(publicDir, 'index.html');
  console.log('Attempting to serve index.html from:', filePath);
  console.log('Public dir:', publicDir);
  console.log('__dirname:', __dirname);
  
  if (fs.existsSync(filePath)) {
    console.log('index.html exists, serving file');
    res.sendFile(filePath, (err) => {
      if (err) {
        console.log('Error serving file:', err);
        res.status(500).send('Error serving landing page');
      }
    });
  } else {
    console.log('index.html not found at path:', filePath);
    res.status(404).send('Landing page not found');
  }
});

// Free trial page
app.get('/free-trial', (req, res) => {
  res.sendFile(path.join(publicDir, 'free-trial.html'));
});

// Panel layout demo page
app.get('/panel-layout-demo', (req, res) => {
  res.sendFile(path.join(publicDir, 'panel-layout-demo.html'));
});

// Panel layout fixed page
app.get('/panel-layout-fixed', (req, res) => {
  res.sendFile(path.join(publicDir, 'panel-layout-fixed.html'));
});

// Login page - only redirect if already authenticated
app.get('/login', (req, res) => {
  // For now, serve login page instead of redirecting
  // TODO: Add session check here later
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Signup page - only redirect if already authenticated  
app.get('/signup', (req, res) => {
  // For now, serve signup page instead of redirecting
  // TODO: Add session check here later
  res.sendFile(path.join(publicDir, 'signup.html'));
});

// Dashboard routes - MUST come before API routes to prevent conflicts
app.use(createProxyMiddleware({
  filter: (pathname, req) => pathname.startsWith('/dashboard'),
  target: 'http://localhost:3001',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log('Dashboard proxy - Original URL:', req.originalUrl);
    console.log('Dashboard proxy - Target path:', proxyReq.path);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Dashboard proxy response - Status:', proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error('Dashboard proxy error:', err);
    res.status(500).send('Dashboard service unavailable');
  }
}));

// API routes - proxy to Backend Server (exclude auth routes) 
app.use(createProxyMiddleware({
  filter: (pathname) => pathname.startsWith('/api/') && !pathname.startsWith('/api/auth'),
  target: 'http://localhost:8003',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log('Backend API proxy - Original URL:', req.originalUrl);
    console.log('Backend API proxy - Target path:', proxyReq.path);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Backend API proxy response - Status:', proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error('Backend API proxy error:', err);
    res.status(500).json({ error: 'Backend API service unavailable' });
  }
}));

// Next.js static assets
app.use('/_next', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  logLevel: 'silent'
}));

// Panel optimizer API - proxy to Panel Optimizer Service
app.use('/panel-api', createProxyMiddleware({
  target: 'http://localhost:8002',
  changeOrigin: true,
  pathRewrite: {
    '^/panel-api': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('Panel API proxy - Original URL:', req.originalUrl);
    console.log('Panel API proxy - Target path:', proxyReq.path);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Panel API proxy response - Status:', proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error('Panel API proxy error:', err);
    res.status(500).json({ error: 'Panel API service unavailable' });
  }
}));

app.use('/static', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  logLevel: 'silent'
}));

app.get('/favicon.ico', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  logLevel: 'silent'
}));

// Static file serving (after specific routes but before catch-all)
app.use(express.static(publicDir, {
  index: false // Disable automatic index.html serving to prevent conflicts
}));

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('WebSocket message received:', message.type);
      
      // Handle different message types
      switch (message.type) {
        case 'subscribe_project':
          ws.projectId = message.data.projectId;
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Broadcast AI job status updates to connected clients
function broadcastJobUpdate(projectId, status) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.projectId === projectId) {
      client.send(JSON.stringify({
        type: 'ai_job_update',
        data: { projectId, status },
        timestamp: Date.now()
      }));
    }
  });
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Dashboard: http://localhost:${PORT}/dashboard`);
});