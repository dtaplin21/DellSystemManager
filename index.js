// Simplified Gateway Server for GeoQC platform

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Public directory for static assets
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

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

// Proxy Next.js static assets first
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

// Dashboard panel layout page (special case - serves from public directory)
app.get('/dashboard/panel-layout', (req, res) => {
  const filePath = path.join(publicDir, 'dashboard', 'panel-layout.html');
  console.log('Attempting to serve:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving panel-layout.html:', err);
      res.status(404).send('Panel layout page not found');
    }
  });
});

// Authentication bypasses - redirect to dashboard
app.get(['/login', '/signup'], (req, res) => {
  res.redirect('/dashboard');
});

// API routes - proxy to Backend Server (BEFORE dashboard routes)
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  }
}));

// Dashboard routes - proxy to Next.js
app.use('/dashboard', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log('Dashboard proxy request:', req.method, req.originalUrl);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Dashboard proxy response:', proxyRes.statusCode);
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