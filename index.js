// Simplified Gateway Server for GeoQC platform

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Replit preview configuration
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS;
const isReplitPreview = !!REPLIT_DOMAINS;

// Use default Express routing for flexibility with dashboard and API routes

// Enhanced request logging and preview middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Host: ${req.get('host')}`);
  
  if (isReplitPreview) {
    const originalHost = req.get('host');
    if (originalHost && originalHost.includes('replit.dev')) {
      req.headers['x-forwarded-host'] = originalHost;
      req.headers['x-forwarded-proto'] = 'https';
    }
  }
  
  next();
});

// Set CORS headers for Replit compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
const { v4: uuidv4 } = require('uuid');

// Simple in-memory user store for demo
const users = new Map();

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
    for (const [id, user] of users.entries()) {
      if (user.email === email) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      displayName: name,
      company: company || null,
      position: null,
      subscription: 'basic',
      profileImageUrl: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    users.set(newUser.id, newUser);
    
    // Generate JWT token
    const token = generateToken(newUser);
    
    // Set cookie
    setTokenCookie(res, token);
    
    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ user: userWithoutPassword });
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
    
    // Find user
    let user = null;
    for (const [id, u] of users.entries()) {
      if (u.email === email) {
        user = u;
        break;
      }
    }
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set cookie
    setTokenCookie(res, token);
    
    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Something went wrong during login' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

// Health check endpoint with debug info
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      gateway: 'running',
      frontend: 'running',
      backend: 'running',
      panelOptimizer: 'running'
    },
    debug: {
      host: req.get('host'),
      userAgent: req.get('user-agent'),
      forwarded: req.get('x-forwarded-for'),
      replitDomains: process.env.REPLIT_DOMAINS,
      isReplitPreview: isReplitPreview
    }
  });
});

// Comprehensive external access endpoints
app.get('/__replco/workspace_iframe.html', (req, res) => {
  res.redirect('/');
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    server: 'gateway',
    timestamp: Date.now(),
    ready: true
  });
});

// Handle root requests properly
app.get('/api/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

// Next.js static assets - MUST come first to prevent routing conflicts
app.use('/_next', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  logLevel: 'silent'
}));

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

// Panel optimizer API - proxy to Panel Optimizer Service (MUST come before dashboard routes)
app.use('/panel-api', createProxyMiddleware({
  target: 'http://localhost:8004',
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

// Dashboard routes - catch all dashboard paths with filter function
app.use(createProxyMiddleware({
  filter: (pathname, req) => pathname.startsWith('/dashboard'),
  target: 'http://localhost:3002',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log('Dashboard proxy - Original URL:', req.originalUrl);
    console.log('Dashboard proxy - Target path:', proxyReq.path);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Dashboard proxy response - Status:', proxyRes.statusCode);
  }
}));

app.use('/static', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  logLevel: 'silent'
}));

app.get('/favicon.ico', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  logLevel: 'silent'
}));

// Root route - proxy to Next.js frontend
app.get('/', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log('Root proxy - Original URL:', req.originalUrl);
  }
}));

// Static file serving (after specific routes but before catch-all)
app.use(express.static(publicDir));

// Configure Express to trust proxies for Replit deployment
app.set('trust proxy', true);

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Dashboard: http://localhost:${PORT}/dashboard`);
  
  if (isReplitPreview && REPLIT_DOMAINS) {
    console.log(`- Replit Preview: https://${REPLIT_DOMAINS}`);
  } else {
    console.log(`- External: http://0.0.0.0:${PORT}`);
  }
});

// Ensure server can handle connections properly for Replit preview
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;
server.timeout = 120000;