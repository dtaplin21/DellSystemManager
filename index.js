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

// Dashboard routes - proxy to Next.js frontend
app.use('/dashboard', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'silent',
  pathRewrite: {
    '^/dashboard': '/dashboard'
  }
}));

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