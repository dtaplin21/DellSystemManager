// Gateway server for geosynthetic QC platform

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Public directory for static files
const publicDir = process.env.REPLIT_DB_URL ? '/home/runner/workspace/public' : path.join(__dirname, 'public');

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    return res.status(200).json({});
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from public directory with no caching
app.use(express.static(publicDir, {
  maxAge: 0,
  etag: false,
  lastModified: false
}));

// Home page - landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Handle authentication routes - redirect to dashboard (no auth needed for demo)
app.get(['/login', '/signup'], (req, res) => {
  res.redirect('/dashboard');
});

// Free trial page route
app.get('/free-trial', (req, res) => {
  console.log('Serving free trial page');
  res.sendFile(path.join(publicDir, 'free-trial.html'));
});

// Configure Next.js proxy with very basic setup
const nextJsConfig = {
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  logLevel: 'error'
};

// Add Next.js proxy routes
app.use('/dashboard', createProxyMiddleware(nextJsConfig));
app.use('/_next', createProxyMiddleware(nextJsConfig));

// API routes go to backend server
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true
}));

// Simple contact form endpoint - demo implementation
app.post('/api/contact', (req, res) => {
  console.log('Contact form submission:', req.body);
  res.json({ success: true, message: 'Thank you for your message!' });
});

// Fallback route handler - redirect HTML requests to home, 404 for others
app.use((req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.redirect('/');
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway server running on port ${PORT}`);
  console.log(`- Main site: http://localhost:${PORT}/`);
  console.log(`- Dashboard: http://localhost:${PORT}/dashboard`);
});