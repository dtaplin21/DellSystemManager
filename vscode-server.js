// Simple standalone server for VSCode
// HOW TO USE:
// 1. Copy this file to your VSCode project
// 2. Create a 'public' folder in the same directory
// 3. Copy all HTML files from Replit's 'public' folder
// 4. Run with: node vscode-server.js
// 5. Access at: http://localhost:5000

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANT: Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Explicit route handlers as backup
app.get('/', (req, res) => {
  console.log('Serving index.html through explicit route handler');
  // Check if file exists first
  const indexPath = path.join(__dirname, 'public/index.html');
  if (fs.existsSync(indexPath)) {
    fs.readFile(indexPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading index file:', err);
        return res.status(500).send('Error loading home page');
      }
      res.set('Content-Type', 'text/html');
      res.send(data);
    });
  } else {
    console.error('index.html file not found at:', indexPath);
    res.status(404).send(`
      <h1>File Not Found</h1>
      <p>The 'public/index.html' file was not found. Make sure you've copied the public folder from Replit.</p>
      <pre>Expected at: ${indexPath}</pre>
    `);
  }
});

// Login route
app.get('/login', (req, res) => {
  const loginPath = path.join(__dirname, 'public/login.html');
  if (fs.existsSync(loginPath)) {
    fs.readFile(loginPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).send('Error loading login page');
      }
      res.set('Content-Type', 'text/html');
      res.send(data);
    });
  } else {
    res.status(404).send('Login page not found. Make sure you copied public/login.html from Replit.');
  }
});

// Signup route
app.get('/signup', (req, res) => {
  const signupPath = path.join(__dirname, 'public/signup.html');
  if (fs.existsSync(signupPath)) {
    fs.readFile(signupPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).send('Error loading signup page');
      }
      res.set('Content-Type', 'text/html');
      res.send(data);
    });
  } else {
    res.status(404).send('Signup page not found. Make sure you copied public/signup.html from Replit.');
  }
});

// Demo dashboard
app.get('/demo', (req, res) => {
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

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`VSCode Server is running at http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log(`- http://localhost:${PORT}/ (Main landing page)`);
  console.log(`- http://localhost:${PORT}/login (Login page)`);
  console.log(`- http://localhost:${PORT}/signup (Signup page)`);
  console.log(`- http://localhost:${PORT}/demo (Dashboard demo)`);
});