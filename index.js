// Professional customer-facing web application

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const events = require('events');

// Increase EventEmitter max listeners to prevent memory leak warnings
events.EventEmitter.defaultMaxListeners = 50;

const app = express();
const PORT = process.env.PORT || 5000;

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    return res.status(200).json({});
  }
  next();
});

// Define the public directory path - works both locally and on Replit
const publicDir = process.env.REPLIT_DB_URL ? '/home/runner/workspace/public' : path.join(__dirname, 'public');

// Serve static assets with max-age=0 (disable cache)
app.use(express.static(publicDir, {
  maxAge: '0',
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

console.log('Static file directory path:', publicDir);

// Home page route - serve the index.html file directly
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  console.log('Serving the landing page from:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Error loading landing page');
    }
  });
});

// Login route - redirects to dashboard since login is no longer required
app.get('/login', (req, res) => {
  console.log('Redirecting from login to dashboard (login bypass)');
  res.redirect('/dashboard');
});

// Signup route - redirects to dashboard since signup is no longer required
app.get('/signup', (req, res) => {
  console.log('Redirecting from signup to dashboard (login bypass)');
  res.redirect('/dashboard');
});

// Free trial route - Replace the old demo with a functional version
app.get('/free-trial', (req, res) => {
  console.log('Serving functional dashboard with empty state UI');
  
  // Get plan from query parameter if available
  const plan = req.query.plan || 'basic';
  console.log('Selected plan:', plan);
  
  const freeTrial = fs.readFileSync(path.join(publicDir, 'free-trial.html'), 'utf8');
  res.send(freeTrial);
});

// Configure Next.js routes
const nextJsRoutes = [
  '/dashboard', 
  '/dashboard/projects',
  '/projects',
  '/_next', 
  '/static', 
  '/account',
  '/api',
  '/app',
  '/__nextjs'
];

// Proxy dashboard routes to the frontend Next.js app
app.use('/dashboard', (req, res, next) => {
  const fullPath = req.originalUrl;
  console.log('Proxying dashboard route to Next.js:', fullPath);
  
  const target = 'http://localhost:3000';
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Proxy error - The Next.js server may not be running');
    }
  });
  
  return proxy(req, res, next);
});

// Proxy Next.js resources
app.use('/_next', createProxyMiddleware({ 
  target: 'http://localhost:3000',
  changeOrigin: true
}));

// Handle any API requests
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true
}));

// Contact form submission endpoint
app.post('/api/contact', (req, res) => {
  console.log('Contact form submission received');
  res.json({ success: true, message: 'Thank you for contacting us!' });
});

// Fallback route handler
app.use((req, res) => {
  console.log(`Fallback handler: ${req.method} ${req.url}`);
  
  // For HTML requests, serve the landing page
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
