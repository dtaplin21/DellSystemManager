// Simple test server to diagnose routing issues
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Basic route
app.get('/', (req, res) => {
  res.send('<h1>Test server is working!</h1><p>If you see this, Express is functioning correctly.</p>');
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log(`Try these URLs:`);
  console.log(`- http://localhost:${PORT}/ (Basic test route)`);
  console.log(`- http://localhost:${PORT}/index.html (Static file test)`);
});