// Simplified Gateway Server for GeoQC platform

const express = require('express');
const path = require('path');
const fs = require('fs');
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
    console.log('validateToken called - req.cookies:', req.cookies);
    console.log('validateToken called - req.headers.authorization:', req.headers.authorization);
    
    let token = req.cookies?.token;
    
    // Also check Authorization header for localStorage tokens
    if (!token && req.headers?.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    
    console.log('Token validation - token found:', !!token);
    console.log('JWT_SECRET available:', !!(process.env.JWT_SECRET || 'default-secret'));
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    console.log('Token decoded successfully:', decoded);
    
    // Get user from database
    const result = await pool.query(`
      SELECT id, email, display_name, company, subscription, created_at, updated_at
      FROM users WHERE id = $1
    `, [decoded.id]);
    
    console.log('Database query result:', result.rows.length, 'users found');
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token - user not found' });
    }
    
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Token validation error:', error);
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Dashboard: http://localhost:${PORT}/dashboard`);
});