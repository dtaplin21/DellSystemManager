// Simple gateway server with straightforward Next.js proxy

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Body parsing
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

// Define the public directory path for static files
const publicDir = process.env.REPLIT_DB_URL ? '/home/runner/workspace/public' : path.join(__dirname, 'public');

// Serve static assets
app.use(express.static(publicDir));

console.log('Static file directory path:', publicDir);

// Home page route
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Error loading landing page');
    }
  });
});

// Login route - redirects to dashboard
app.get('/login', (req, res) => {
  res.redirect('/dashboard');
});

// Signup route - redirects to dashboard
app.get('/signup', (req, res) => {
  res.redirect('/dashboard');
});

// Free trial route
app.get('/free-trial', (req, res) => {
  console.log('Serving functional dashboard with empty state UI');
  const plan = req.query.plan || 'basic';
  console.log('Selected plan:', plan);
  
  const freeTrial = fs.readFileSync(path.join(publicDir, 'free-trial.html'), 'utf8');
  res.send(freeTrial);
});

// Simple Next.js proxy setup
const nextJsProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  logLevel: 'silent',
  onProxyReq: (proxyReq, req, res) => {
    // Don't do anything special to the request
  },
  onError: (err, req, res) => {
    console.error('Next.js proxy error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error - The Next.js server may not be running');
  }
});

// Dashboard route
app.use('/dashboard', nextJsProxy);

// Next.js static assets
app.use('/_next', nextJsProxy);

// API requests to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true
}));

// Contact form submission endpoint
app.post('/api/contact', (req, res) => {
  res.json({ success: true, message: 'Thank you for contacting us!' });
});

// Fallback handler
app.use((req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.redirect('/');
  } else {
    res.status(404).send('Not found');
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Main site: http://localhost:${PORT}/`);
  console.log(`- Login page: http://localhost:${PORT}/login`);
  console.log(`- Signup page: http://localhost:${PORT}/signup`);
  console.log(`- Free trial dashboard: http://localhost:${PORT}/free-trial`);
  console.log(`- Next.js Dashboard: http://localhost:${PORT}/dashboard`);
});