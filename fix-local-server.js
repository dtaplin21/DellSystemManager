/**
 * Simple standalone server for VSCode local development
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to your local VSCode project (same level as your public folder)
 * 2. Make sure the public folder contains index.html, login.html, and signup.html
 * 3. Run with: node fix-local-server.js
 * 4. Access at: http://localhost:5000
 *
 * This server has simplified error handling to help diagnose issues
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// Enable detailed logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANT: Explicitly check if public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  console.error('PUBLIC DIRECTORY NOT FOUND AT:', publicDir);
  console.error('Please create a public directory with the HTML files');
  process.exit(1);
}

// IMPORTANT: Explicitly check if index.html exists
const indexHtmlPath = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  console.error('INDEX.HTML NOT FOUND AT:', indexHtmlPath);
  console.error('Please copy index.html to the public directory');
  process.exit(1);
}

// Serve static files with explicit error handling
app.use(express.static(publicDir, {
  fallthrough: true,  // Enable fallback to route handlers
  index: false        // Disable automatic serving of index.html to use our explicit handler
}));

// Explicit route handlers for better error handling
app.get('/', (req, res) => {
  console.log('Serving index.html through explicit route handler');
  try {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    res.set('Content-Type', 'text/html');
    res.send(indexHtml);
  } catch (err) {
    console.error('Error reading index file:', err);
    res.status(500).send(`
      <h1>Error Loading Home Page</h1>
      <p>There was an error reading the index.html file:</p>
      <pre>${err.message}</pre>
      <p>Check if the file exists at: ${indexHtmlPath}</p>
    `);
  }
});

// Login route
app.get('/login', (req, res) => {
  console.log('Serving login.html through explicit route handler');
  try {
    const loginHtml = fs.readFileSync(path.join(publicDir, 'login.html'), 'utf8');
    res.set('Content-Type', 'text/html');
    res.send(loginHtml);
  } catch (err) {
    console.error('Error reading login file:', err);
    res.status(500).send('Error loading login page: ' + err.message);
  }
});

// Signup route
app.get('/signup', (req, res) => {
  console.log('Serving signup.html through explicit route handler');
  try {
    const signupHtml = fs.readFileSync(path.join(publicDir, 'signup.html'), 'utf8');
    res.set('Content-Type', 'text/html');
    res.send(signupHtml);
  } catch (err) {
    console.error('Error reading signup file:', err);
    res.status(500).send('Error loading signup page: ' + err.message);
  }
});

// Demo route with hardcoded HTML
app.get('/demo', (req, res) => {
  console.log('Serving demo dashboard');
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GeoSynth QC Pro - Dashboard Demo</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f5f8fa;
          color: #172b4d;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        
        .logo {
          font-size: 1.8rem;
          font-weight: 700;
          color: #0052cc;
        }
        
        .nav-links {
          display: flex;
          gap: 1.5rem;
        }
        
        .nav-links a {
          text-decoration: none;
          color: #172b4d;
          font-weight: 500;
        }
        
        h1 {
          font-size: 2.2rem;
          margin-bottom: 1rem;
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .dashboard-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          padding: 1.5rem;
        }
        
        .stat-card {
          display: flex;
          flex-direction: column;
        }
        
        .stat-value {
          font-size: 2.2rem;
          font-weight: 700;
          margin: 0.5rem 0;
          color: #0052cc;
        }
        
        .projects-table {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th {
          text-align: left;
          padding: 1rem;
          background-color: #f5f8fa;
          font-weight: 600;
        }
        
        td {
          padding: 1rem;
          border-top: 1px solid #f0f0f0;
        }
        
        .status {
          display: inline-block;
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .status.complete {
          background-color: #E3FCEF;
          color: #00875A;
        }
        
        .status.in-progress {
          background-color: #DEEBFF;
          color: #0747A6;
        }
        
        .status.planned {
          background-color: #FFF0B3;
          color: #172B4D;
        }
        
        footer {
          text-align: center;
          margin-top: 3rem;
          padding-top: 1.5rem;
          border-top: 1px solid #dfe1e6;
          color: #6B778C;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo">GeoQC</div>
          <div class="nav-links">
            <a href="/">Home</a>
            <a href="/login">Login</a>
            <a href="/signup">Sign Up</a>
          </div>
        </header>
        
        <h1>Dashboard Demo</h1>
        <p>This is a simplified demonstration of the dashboard interface for the QC Management System.</p>
        
        <div class="dashboard-grid">
          <div class="dashboard-card stat-card">
            <h3>Active Projects</h3>
            <div class="stat-value">12</div>
            <p>4 pending approval</p>
          </div>
          
          <div class="dashboard-card stat-card">
            <h3>QC Tests</h3>
            <div class="stat-value">142</div>
            <p>98.6% pass rate</p>
          </div>
          
          <div class="dashboard-card stat-card">
            <h3>Material Usage</h3>
            <div class="stat-value">87%</div>
            <p>Efficiency rating</p>
          </div>
          
          <div class="dashboard-card stat-card">
            <h3>Team Members</h3>
            <div class="stat-value">7</div>
            <p>3 online now</p>
          </div>
        </div>
        
        <div class="projects-table">
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Client</th>
                <th>Start Date</th>
                <th>Status</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Riverside Expansion</td>
                <td>Dell Construction Co.</td>
                <td>May 1, 2025</td>
                <td><span class="status in-progress">In Progress</span></td>
                <td>65%</td>
              </tr>
              <tr>
                <td>North Shore Containment</td>
                <td>EcoSolutions Inc.</td>
                <td>April 15, 2025</td>
                <td><span class="status complete">Complete</span></td>
                <td>100%</td>
              </tr>
              <tr>
                <td>Hillside Erosion Control</td>
                <td>Mountain Development</td>
                <td>May 10, 2025</td>
                <td><span class="status planned">Planned</span></td>
                <td>0%</td>
              </tr>
              <tr>
                <td>Central Valley Landfill</td>
                <td>County Services</td>
                <td>March 22, 2025</td>
                <td><span class="status in-progress">In Progress</span></td>
                <td>78%</td>
              </tr>
              <tr>
                <td>Waterfront Protection</td>
                <td>Coastal Authority</td>
                <td>April 30, 2025</td>
                <td><span class="status in-progress">In Progress</span></td>
                <td>42%</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <footer>
          <p>© 2025 GeoQC Pro. All rights reserved.</p>
          <p>This is a demonstration only.</p>
        </footer>
      </div>
    </body>
    </html>
  `);
});

// Catch-all route - for debugging
app.use((req, res) => {
  res.status(404).send(`
    <h1>Cannot GET ${req.path}</h1>
    <p>The path "${req.path}" was not found. Available routes are:</p>
    <ul>
      <li><a href="/">Home Page</a></li>
      <li><a href="/login">Login Page</a></li>
      <li><a href="/signup">Signup Page</a></li>
      <li><a href="/demo">Dashboard Demo</a></li>
    </ul>
    <hr>
    <h2>Debugging Information</h2>
    <p><strong>Public directory path:</strong> ${publicDir}</p>
    <p><strong>Request URL:</strong> ${req.url}</p>
    <p><strong>Request method:</strong> ${req.method}</p>
    <p><strong>Public directory exists:</strong> ${fs.existsSync(publicDir) ? 'Yes' : 'No'}</p>
    <p><strong>index.html exists:</strong> ${fs.existsSync(indexHtmlPath) ? 'Yes' : 'No'}</p>
  `);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log(`- http://localhost:${PORT}/ (Main landing page)`);
  console.log(`- http://localhost:${PORT}/login (Login page)`);
  console.log(`- http://localhost:${PORT}/signup (Signup page)`);
  console.log(`- http://localhost:${PORT}/demo (Dashboard demo)`);
});