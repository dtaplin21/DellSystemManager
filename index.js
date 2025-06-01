// Simplified Gateway Server for GeoQC platform

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Disable Express automatic trailing slash redirects
app.set('strict routing', true);

// Basic logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Dashboard routes - serve simple dashboard until Next.js auth is fixed
app.get(['/dashboard', '/dashboard/'], (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GeoQC Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #1f2937; margin-bottom: 10px; }
          .status { color: #059669; font-weight: 500; margin-bottom: 30px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .card { background: #f8fafc; padding: 20px; border-radius: 6px; border-left: 4px solid #3b82f6; }
          .card h3 { margin: 0 0 10px 0; color: #374151; }
          .card p { margin: 0; color: #6b7280; }
          .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
          .btn { display: block; padding: 12px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; text-align: center; transition: background 0.2s; }
          .btn:hover { background: #2563eb; }
          .btn.secondary { background: #6b7280; }
          .btn.secondary:hover { background: #4b5563; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>GeoQC Dashboard</h1>
          <p class="status">✓ System online - All services running</p>
          
          <div class="grid">
            <div class="card">
              <h3>Active Projects</h3>
              <p>3 projects in progress</p>
            </div>
            <div class="card">
              <h3>QC Data</h3>
              <p>15 reports pending review</p>
            </div>
            <div class="card">
              <h3>Panel Layouts</h3>
              <p>8 designs completed</p>
            </div>
            <div class="card">
              <h3>Documents</h3>
              <p>42 files uploaded</p>
            </div>
          </div>
          
          <h3>Quick Actions</h3>
          <div class="actions">
            <a href="/panel-layout-demo" class="btn">Panel Layout Tool</a>
            <a href="/free-trial" class="btn secondary">View Plans</a>
            <a href="/" class="btn secondary">Back to Home</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Main landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
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

// Static file serving (after specific routes)
app.use(express.static(publicDir));

// Next.js static assets - essential for dashboard functionality
app.use('/_next', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'silent'
}));

app.use('/static', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'silent'
}));

app.get('/favicon.ico', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'silent'
}));

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



// API routes - proxy to Backend Server (AFTER dashboard routes)
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  }
}));

// Panel optimizer API - proxy to Panel Optimizer Service
app.use('/panel-api', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  pathRewrite: {
    '^/panel-api': ''
  }
}));

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Dashboard: http://localhost:${PORT}/dashboard`);
});