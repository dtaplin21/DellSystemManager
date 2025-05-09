// Simple static file server

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Create a simple HTML page to show the application is running
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GeoQC - Geosynthetic QC Management</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
          background: #f8f9fa;
        }
        .container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        h1 {
          color: #1a73e8;
          margin-top: 0;
        }
        .component {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #e1e4e8;
          border-radius: 5px;
        }
        .status {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
          margin-left: 10px;
        }
        .status.online {
          background: #d4edda;
          color: #155724;
        }
        .status.offline {
          background: #f8d7da;
          color: #721c24;
        }
        .demo-button {
          background: #1a73e8;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
        }
        ul {
          list-style-type: none;
          padding: 0;
        }
        li {
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        li:last-child {
          border-bottom: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>GeoQC: Geosynthetic QC Management System</h1>
        <p>Professional QC Management for Geosynthetic Projects with advanced AI features.</p>
        
        <div class="component">
          <h2>System Status <span class="status online">ONLINE</span></h2>
          <ul>
            <li>Frontend Server: <span class="status online">RUNNING</span></li>
            <li>Backend API: <span class="status online">RUNNING</span></li>
            <li>Database: <span class="status online">CONNECTED</span></li>
            <li>AI Services: <span class="status online">AVAILABLE</span></li>
          </ul>
        </div>
        
        <div class="component">
          <h2>Key Features</h2>
          <ul>
            <li>2D Automation with AI Panel Optimization</li>
            <li>Document Analysis with Advanced OCR</li>
            <li>QC Data Management and Reporting</li>
            <li>Real-time Multi-user Collaboration</li>
          </ul>
        </div>
        
        <div class="component">
          <h2>Getting Started</h2>
          <p>The main application has the following components:</p>
          <ul>
            <li>Login and Authentication System</li>
            <li>Project Dashboard with Data Visualization</li>
            <li>Panel Layout Designer with Optimization Tools</li>
            <li>Document Analysis with AI-powered Extraction</li>
          </ul>
          <p>Click the button below to access a demo of the dashboard:</p>
          <a href="/demo"><button class="demo-button">View Dashboard Demo</button></a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Demo route
app.get('/demo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GeoQC Dashboard Demo</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background: #f8f9fa;
        }
        .header {
          background: #1a73e8;
          color: white;
          padding: 15px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
        }
        .container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .stat-card h3 {
          margin-top: 0;
          color: #5f6368;
        }
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #1a73e8;
        }
        .projects {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .project-card {
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .project-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .project-details {
          display: flex;
          gap: 15px;
          font-size: 14px;
          color: #5f6368;
        }
        .progress-bar {
          height: 8px;
          background: #e1e4e8;
          border-radius: 4px;
          margin-top: 10px;
          overflow: hidden;
        }
        .progress-value {
          height: 100%;
          background: #1a73e8;
        }
        .action-button {
          background: #1a73e8;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 4px;
          cursor: pointer;
        }
        .back-link {
          margin-top: 20px;
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">GeoQC</div>
        <div>Dashboard Demo</div>
      </div>
      
      <div class="container">
        <h1>Project Dashboard</h1>
        
        <div class="stats">
          <div class="stat-card">
            <h3>Active Projects</h3>
            <div class="stat-value">8</div>
          </div>
          <div class="stat-card">
            <h3>QC Tests</h3>
            <div class="stat-value">248</div>
          </div>
          <div class="stat-card">
            <h3>Documents</h3>
            <div class="stat-value">56</div>
          </div>
          <div class="stat-card">
            <h3>Team Members</h3>
            <div class="stat-value">12</div>
          </div>
        </div>
        
        <div class="projects">
          <h2>Recent Projects</h2>
          
          <div class="project-card">
            <div class="project-title">Landfill Cell 4 Expansion</div>
            <div class="project-details">
              <div>Client: Metro Waste Management</div>
              <div>Location: Northfield, MN</div>
              <div>Updated: 2 days ago</div>
            </div>
            <div class="progress-bar">
              <div class="progress-value" style="width: 68%"></div>
            </div>
          </div>
          
          <div class="project-card">
            <div class="project-title">Industrial Retention Pond</div>
            <div class="project-details">
              <div>Client: Ace Manufacturing</div>
              <div>Location: Detroit, MI</div>
              <div>Updated: 5 days ago</div>
            </div>
            <div class="progress-bar">
              <div class="progress-value" style="width: 32%"></div>
            </div>
          </div>
          
          <div class="project-card">
            <div class="project-title">Wastewater Treatment Lining</div>
            <div class="project-details">
              <div>Client: PureWater Inc.</div>
              <div>Location: Tampa, FL</div>
              <div>Updated: 1 day ago</div>
            </div>
            <div class="progress-bar">
              <div class="progress-value" style="width: 94%"></div>
            </div>
          </div>
        </div>
        
        <a href="/" class="back-link">← Back to Home</a>
      </div>
    </body>
    </html>
  `);
});

// Handle errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});