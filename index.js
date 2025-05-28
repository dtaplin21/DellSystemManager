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

// Dashboard panel layout page
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

// Dashboard projects route - proxy to Frontend Server
app.use('/dashboard/projects', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/dashboard/projects': '/dashboard/projects'
  }
}));

// Authentication bypasses - redirect to dashboard
app.get(['/login', '/signup'], (req, res) => {
  res.redirect('/dashboard');
});

// For the dashboard, serve a simplified dashboard page directly
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GeoQC - Dashboard</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #f5f8fa;
          color: #334e68;
        }
        header {
          background: white;
          padding: 1rem 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          font-weight: bold;
          font-size: 1.5rem;
          color: #0a2463;
        }
        nav {
          display: flex;
          gap: 1.5rem;
        }
        nav a {
          text-decoration: none;
          color: #486581;
        }
        nav a:hover {
          color: #ff7f11;
        }
        .active {
          color: #0a2463;
          font-weight: 500;
        }
        main {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          padding: 1.5rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e9ecef;
        }
        .card-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }
        .card-badge {
          display: inline-block;
          padding: 0.35rem 0.65rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
          background: #ff7f11;
          color: white;
        }
        .card-content {
          color: #627d98;
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          margin: 1rem 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #ff7f11;
          border-radius: 4px;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e9ecef;
        }
        .button {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .button-primary {
          background: #0a2463;
          color: white;
        }
        .button-primary:hover {
          background: #041640;
        }
        .button-outline {
          border: 1px solid #0a2463;
          color: #0a2463;
          background: white;
        }
        .button-outline:hover {
          background: #f0f4f8;
        }
        .page-title {
          margin-bottom: 1.5rem;
        }
        .highlight-section {
          margin-top: 3rem;
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .highlight-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .highlight-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #0a2463;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <header>
        <div class="logo">GeoQC</div>
        <nav>
          <a href="/dashboard" class="active">Dashboard</a>
          <a href="/dashboard/projects">Projects</a>
          <a href="/dashboard/panel-layout">Panel Layout</a>
          <a href="/dashboard/qc-data">QC Data</a>
          <a href="/dashboard/documents">Documents</a>
        </nav>
        <div>
          <span>User123</span>
        </div>
      </header>
      
      <main>
        <div class="page-title">
          <h1>Welcome to Your Dashboard</h1>
          <p>Manage your geosynthetic quality control projects and data</p>
        </div>
        
        <div class="card-grid">
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Landfill Cell 4 Expansion</h2>
              <span class="card-badge">Active</span>
            </div>
            <div class="card-content">
              <div><strong>Client:</strong> Metro Waste Management</div>
              <div><strong>Location:</strong> Northfield, MN</div>
              <div><strong>Last Updated:</strong> May 1, 2025</div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: 68%"></div>
              </div>
              <div style="display: flex; justify-content: space-between">
                <span>Progress</span>
                <span>68%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/1" class="button button-outline">View</a>
              <button class="button button-primary">Edit</button>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Industrial Retention Pond</h2>
              <span class="card-badge" style="background: #627d98">In Progress</span>
            </div>
            <div class="card-content">
              <div><strong>Client:</strong> Ace Manufacturing</div>
              <div><strong>Location:</strong> Detroit, MI</div>
              <div><strong>Last Updated:</strong> April 28, 2025</div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: 32%"></div>
              </div>
              <div style="display: flex; justify-content: space-between">
                <span>Progress</span>
                <span>32%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/2" class="button button-outline">View</a>
              <button class="button button-primary">Edit</button>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Wastewater Treatment Lining</h2>
              <span class="card-badge" style="background: #36b37e">Completed</span>
            </div>
            <div class="card-content">
              <div><strong>Client:</strong> PureWater Inc.</div>
              <div><strong>Location:</strong> Tampa, FL</div>
              <div><strong>Last Updated:</strong> May 3, 2025</div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: 94%"></div>
              </div>
              <div style="display: flex; justify-content: space-between">
                <span>Progress</span>
                <span>94%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/3" class="button button-outline">View</a>
              <button class="button button-primary">Edit</button>
            </div>
          </div>
        </div>
        
        <div class="highlight-section">
          <div class="highlight-header">
            <h2 class="highlight-title">Recent QC Data</h2>
            <a href="/dashboard/qc-data" class="button button-outline">View All</a>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 1rem">
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid #e9ecef">
              <div>
                <div style="font-weight: 500">Seam Strength Test #42</div>
                <div style="font-size: 0.875rem; color: #627d98">Landfill Cell 4 Expansion</div>
              </div>
              <div style="color: #36b37e; font-weight: 500">PASS</div>
            </div>
            
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid #e9ecef">
              <div>
                <div style="font-weight: 500">Thickness Test #18</div>
                <div style="font-size: 0.875rem; color: #627d98">Industrial Retention Pond</div>
              </div>
              <div style="color: #36b37e; font-weight: 500">PASS</div>
            </div>
            
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid #e9ecef">
              <div>
                <div style="font-weight: 500">Puncture Resistance #05</div>
                <div style="font-size: 0.875rem; color: #627d98">Wastewater Treatment Lining</div>
              </div>
              <div style="color: #ff7f11; font-weight: 500">WARNING</div>
            </div>
          </div>
        </div>
      </main>
    </body>
    </html>
  `);
});

// Project details page
app.get('/dashboard/projects/:id', (req, res) => {
  const projectId = req.params.id;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GeoQC - Project Details</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #f5f8fa;
          color: #334e68;
        }
        header {
          background: white;
          padding: 1rem 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          font-weight: bold;
          font-size: 1.5rem;
          color: #0a2463;
        }
        nav {
          display: flex;
          gap: 1.5rem;
        }
        nav a {
          text-decoration: none;
          color: #486581;
        }
        nav a:hover {
          color: #ff7f11;
        }
        .active {
          color: #0a2463;
          font-weight: 500;
        }
        main {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .button {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .button-primary {
          background: #0a2463;
          color: white;
        }
        .button-primary:hover {
          background: #041640;
        }
        .section {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .project-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
        }
        .detail-item {
          margin-bottom: 1rem;
        }
        .detail-label {
          font-size: 0.875rem;
          color: #627d98;
          margin-bottom: 0.25rem;
        }
        .detail-value {
          font-size: 1rem;
          font-weight: 500;
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          margin: 1rem 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #ff7f11;
          border-radius: 4px;
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 1.5rem;
        }
        .tab {
          padding: 0.75rem 1.5rem;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }
        .tab.active {
          border-bottom-color: #0a2463;
          color: #0a2463;
          font-weight: 500;
        }
        
        /* Edit Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: none;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-overlay.active {
          display: flex;
        }
        
        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e9ecef;
        }
        
        .modal-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #0a2463;
          margin: 0;
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #627d98;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close-button:hover {
          color: #0a2463;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #334e68;
        }
        
        .form-input, .form-select, .form-textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.2s;
        }
        
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: #0a2463;
          box-shadow: 0 0 0 2px rgba(10, 36, 99, 0.1);
        }
        
        .form-textarea {
          min-height: 100px;
          resize: vertical;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e9ecef;
        }
        
        .button-secondary {
          background: #f8f9fa;
          color: #627d98;
          border: 1px solid #e9ecef;
        }
        
        .button-secondary:hover {
          background: #e9ecef;
        }
      </style>
    </head>
    <body>
      <header>
        <div class="logo">GeoQC</div>
        <nav>
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/projects" class="active">Projects</a>
          <a href="/dashboard/qc-data">QC Data</a>
          <a href="/dashboard/documents">Documents</a>
          <a href="/settings">Settings</a>
        </nav>
        <div>
          <span>User123</span>
        </div>
      </header>
      
      <main>
        <div class="page-header">
          <div>
            <h1>Project Details</h1>
            <div style="display: flex; align-items: center; gap: 1rem">
              <a href="/dashboard/projects" style="color: #627d98">← Back to Projects</a>
              <span style="display: inline-block; padding: 0.35rem 0.65rem; border-radius: 20px; font-size: 0.75rem; font-weight: 500; background: #ff7f11; color: white;">Active</span>
            </div>
          </div>
          <div>
            <button class="button button-primary" id="edit-project-btn">Edit Project</button>
          </div>
        </div>
        
        <div class="section">
          <div class="project-details">
            <div>
              <div class="detail-item">
                <div class="detail-label">Project Name</div>
                <div class="detail-value">Project #${projectId}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Client</div>
                <div class="detail-value">Example Client</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Start Date</div>
                <div class="detail-value">May 1, 2025</div>
              </div>
            </div>
            
            <div>
              <div class="detail-item">
                <div class="detail-label">Location</div>
                <div class="detail-value">Example Location</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Project Manager</div>
                <div class="detail-value">John Smith</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">End Date (Est.)</div>
                <div class="detail-value">August 15, 2025</div>
              </div>
            </div>
            
            <div>
              <div class="detail-item">
                <div class="detail-label">Progress</div>
                <div style="display: flex; justify-content: space-between">
                  <span>50%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 50%"></div>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Last Updated</div>
                <div class="detail-value">May 10, 2025</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="tabs">
            <div class="tab active">Overview</div>
            <div class="tab">Panel Layout</div>
            <div class="tab">QC Data</div>
            <div class="tab">Documents</div>
            <div class="tab">Team</div>
          </div>
          
          <div>
            <h2>Project Description</h2>
            <p>This is a detailed overview of project #${projectId}. The project involves geosynthetic liner installation for environmental containment purposes. The scope includes material selection, installation planning, quality control procedures, and final documentation.</p>
            
            <h2>Key Metrics</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 1.5rem">
              <div style="background: #f0f4f8; padding: 1.5rem; border-radius: 8px; text-align: center">
                <div style="font-size: 2rem; font-weight: 600; color: #0a2463">12,500 m²</div>
                <div>Total Area</div>
              </div>
              
              <div style="background: #f0f4f8; padding: 1.5rem; border-radius: 8px; text-align: center">
                <div style="font-size: 2rem; font-weight: 600; color: #0a2463">42</div>
                <div>Total Panels</div>
              </div>
              
              <div style="background: #f0f4f8; padding: 1.5rem; border-radius: 8px; text-align: center">
                <div style="font-size: 2rem; font-weight: 600; color: #0a2463">85%</div>
                <div>QC Pass Rate</div>
              </div>
              
              <div style="background: #f0f4f8; padding: 1.5rem; border-radius: 8px; text-align: center">
                <div style="font-size: 2rem; font-weight: 600; color: #0a2463">28</div>
                <div>Days Remaining</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Edit Project Modal -->
        <div class="modal-overlay" id="edit-modal">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title">Edit Project</h2>
              <button class="close-button" id="close-modal">&times;</button>
            </div>
            
            <form id="edit-project-form">
              <div class="form-group">
                <label class="form-label" for="project-name">Project Name</label>
                <input type="text" class="form-input" id="project-name" value="Project #${projectId}" required>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="client-name">Client</label>
                  <input type="text" class="form-input" id="client-name" value="Example Client" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="project-manager">Project Manager</label>
                  <input type="text" class="form-input" id="project-manager" value="John Smith" required>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="start-date">Start Date</label>
                  <input type="date" class="form-input" id="start-date" value="2025-05-01" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="end-date">End Date (Est.)</label>
                  <input type="date" class="form-input" id="end-date" value="2025-08-15" required>
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label" for="location">Location</label>
                <input type="text" class="form-input" id="location" value="Example Location" required>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="status">Status</label>
                  <select class="form-select" id="status" required>
                    <option value="Active" selected>Active</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="progress">Progress (%)</label>
                  <input type="number" class="form-input" id="progress" value="50" min="0" max="100" required>
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label" for="description">Project Description</label>
                <textarea class="form-textarea" id="description" required>This is a detailed overview of project #${projectId}. The project involves geosynthetic liner installation for environmental containment purposes.</textarea>
              </div>
              
              <div class="modal-footer">
                <button type="button" class="button button-secondary" id="cancel-edit">Cancel</button>
                <button type="submit" class="button button-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </main>
      
      <script>
        // Edit Project Modal Functionality
        const editBtn = document.getElementById('edit-project-btn');
        const modal = document.getElementById('edit-modal');
        const closeBtn = document.getElementById('close-modal');
        const cancelBtn = document.getElementById('cancel-edit');
        const form = document.getElementById('edit-project-form');
        
        // Open modal
        editBtn.addEventListener('click', () => {
          modal.classList.add('active');
        });
        
        // Close modal functions
        const closeModal = () => {
          modal.classList.remove('active');
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeModal();
          }
        });
        
        // Handle form submission
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          
          // Get form data
          const formData = {
            name: document.getElementById('project-name').value,
            client: document.getElementById('client-name').value,
            manager: document.getElementById('project-manager').value,
            startDate: document.getElementById('start-date').value,
            endDate: document.getElementById('end-date').value,
            location: document.getElementById('location').value,
            status: document.getElementById('status').value,
            progress: document.getElementById('progress').value,
            description: document.getElementById('description').value
          };
          
          // Show success message
          alert('Project updated successfully!');
          
          // Update page content with new data
          updatePageContent(formData);
          
          // Close modal
          closeModal();
        });
        
        // Update page content function
        function updatePageContent(data) {
          // Update project details on the page
          const detailValues = document.querySelectorAll('.detail-value');
          if (detailValues.length >= 6) {
            detailValues[0].textContent = data.name;
            detailValues[1].textContent = data.client;
            detailValues[2].textContent = new Date(data.startDate).toLocaleDateString();
            detailValues[3].textContent = data.location;
            detailValues[4].textContent = data.manager;
            detailValues[5].textContent = new Date(data.endDate).toLocaleDateString();
          }
          
          // Update progress bar and percentage
          const progressFill = document.querySelector('.progress-fill');
          if (progressFill) {
            progressFill.style.width = data.progress + '%';
            // Update progress text
            const progressContainer = progressFill.parentElement.previousElementSibling;
            if (progressContainer) {
              progressContainer.innerHTML = '<span>' + data.progress + '%</span>';
            }
          }
          
          // Update status badge
          const statusBadge = document.querySelector('.page-header span[style*="background"]');
          if (statusBadge) {
            statusBadge.textContent = data.status;
            // Update badge color based on status
            let bgColor = '#ff7f11'; // default orange
            switch(data.status) {
              case 'Active': bgColor = '#ff7f11'; break;
              case 'Completed': bgColor = '#36b37e'; break;
              case 'In Progress': bgColor = '#627d98'; break;
              case 'On Hold': bgColor = '#f39c12'; break;
              case 'Delayed': bgColor = '#e74c3c'; break;
            }
            statusBadge.style.background = bgColor;
          }
          
          // Update description
          const descriptionEl = document.querySelector('main p');
          if (descriptionEl) {
            descriptionEl.textContent = data.description;
          }
          
          // Update last updated date
          const lastUpdatedEl = document.querySelector('.detail-value:last-child');
          if (lastUpdatedEl) {
            lastUpdatedEl.textContent = new Date().toLocaleDateString();
          }
        }
      </script>
    </body>
    </html>
  `);
});

// All projects page
app.get('/dashboard/projects', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GeoQC - Projects</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #f5f8fa;
          color: #334e68;
        }
        header {
          background: white;
          padding: 1rem 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          font-weight: bold;
          font-size: 1.5rem;
          color: #0a2463;
        }
        nav {
          display: flex;
          gap: 1.5rem;
        }
        nav a {
          text-decoration: none;
          color: #486581;
        }
        nav a:hover {
          color: #ff7f11;
        }
        .active {
          color: #0a2463;
          font-weight: 500;
        }
        main {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .button {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .button-primary {
          background: #0a2463;
          color: white;
        }
        .button-primary:hover {
          background: #041640;
        }
        .filters {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          background: white;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          align-items: center;
        }
        .search {
          flex-grow: 1;
        }
        .search input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #e9ecef;
          border-radius: 4px;
        }
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .project-card {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .project-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .card-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .project-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }
        .status-badge {
          display: inline-block;
          padding: 0.35rem 0.65rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .badge-active {
          background: #ff7f11;
          color: white;
        }
        .badge-completed {
          background: #36b37e;
          color: white;
        }
        .badge-inprogress {
          background: #627d98;
          color: white;
        }
        .card-content {
          padding: 1.5rem;
        }
        .project-detail {
          margin-bottom: 0.5rem;
          display: flex;
        }
        .detail-label {
          width: 80px;
          color: #627d98;
          font-size: 0.875rem;
        }
        .detail-value {
          flex-grow: 1;
          font-weight: 500;
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          margin: 1rem 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #ff7f11;
          border-radius: 4px;
        }
        .card-footer {
          padding: 1rem 1.5rem;
          background: #f8f9fa;
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        .card-button {
          padding: 0.35rem 0.75rem;
          border-radius: 4px;
          text-decoration: none;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-view {
          border: 1px solid #0a2463;
          color: #0a2463;
          background: white;
        }
        .btn-view:hover {
          background: #f0f4f8;
        }
        .btn-edit {
          background: #0a2463;
          color: white;
          border: none;
        }
        .btn-edit:hover {
          background: #041640;
        }
      </style>
    </head>
    <body>
      <header>
        <div class="logo">GeoQC</div>
        <nav>
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/projects" class="active">Projects</a>
          <a href="/dashboard/qc-data">QC Data</a>
          <a href="/dashboard/documents">Documents</a>
          <a href="/settings">Settings</a>
        </nav>
        <div>
          <span>User123</span>
        </div>
      </header>
      
      <main>
        <div class="page-header">
          <h1>Projects</h1>
          <button class="button button-primary">
            <span>+ New Project</span>
          </button>
        </div>
        
        <div class="filters">
          <div class="search">
            <input type="text" placeholder="Search projects...">
          </div>
          <div>
            <select>
              <option>All Statuses</option>
              <option>Active</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>
          <div>
            <select>
              <option>All Clients</option>
              <option>Metro Waste Management</option>
              <option>Ace Manufacturing</option>
              <option>PureWater Inc.</option>
            </select>
          </div>
        </div>
        
        <div class="projects-grid">
          <div class="project-card">
            <div class="card-header">
              <h2 class="project-title">Landfill Cell 4 Expansion</h2>
              <span class="status-badge badge-active">Active</span>
            </div>
            <div class="card-content">
              <div class="project-detail">
                <span class="detail-label">Client:</span>
                <span class="detail-value">Metro Waste Management</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Location:</span>
                <span class="detail-value">Northfield, MN</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Updated:</span>
                <span class="detail-value">May 1, 2025</span>
              </div>
              
              <div class="progress-bar">
                <div class="progress-fill" style="width: 68%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.875rem">
                <span>Progress</span>
                <span>68%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/1" class="card-button btn-view">View</a>
              <button class="card-button btn-edit">Edit</button>
            </div>
          </div>
          
          <div class="project-card">
            <div class="card-header">
              <h2 class="project-title">Industrial Retention Pond</h2>
              <span class="status-badge badge-inprogress">In Progress</span>
            </div>
            <div class="card-content">
              <div class="project-detail">
                <span class="detail-label">Client:</span>
                <span class="detail-value">Ace Manufacturing</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Location:</span>
                <span class="detail-value">Detroit, MI</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Updated:</span>
                <span class="detail-value">April 28, 2025</span>
              </div>
              
              <div class="progress-bar">
                <div class="progress-fill" style="width: 32%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.875rem">
                <span>Progress</span>
                <span>32%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/2" class="card-button btn-view">View</a>
              <button class="card-button btn-edit">Edit</button>
            </div>
          </div>
          
          <div class="project-card">
            <div class="card-header">
              <h2 class="project-title">Wastewater Treatment Lining</h2>
              <span class="status-badge badge-completed">Completed</span>
            </div>
            <div class="card-content">
              <div class="project-detail">
                <span class="detail-label">Client:</span>
                <span class="detail-value">PureWater Inc.</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Location:</span>
                <span class="detail-value">Tampa, FL</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Updated:</span>
                <span class="detail-value">May 3, 2025</span>
              </div>
              
              <div class="progress-bar">
                <div class="progress-fill" style="width: 100%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.875rem">
                <span>Progress</span>
                <span>100%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/3" class="card-button btn-view">View</a>
              <button class="card-button btn-edit">Edit</button>
            </div>
          </div>
          
          <div class="project-card">
            <div class="card-header">
              <h2 class="project-title">Eastwood Landfill Cover</h2>
              <span class="status-badge badge-active">Active</span>
            </div>
            <div class="card-content">
              <div class="project-detail">
                <span class="detail-label">Client:</span>
                <span class="detail-value">Eastwood County</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Location:</span>
                <span class="detail-value">Eastwood, OR</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Updated:</span>
                <span class="detail-value">May 10, 2025</span>
              </div>
              
              <div class="progress-bar">
                <div class="progress-fill" style="width: 55%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.875rem">
                <span>Progress</span>
                <span>55%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/4" class="card-button btn-view">View</a>
              <button class="card-button btn-edit">Edit</button>
            </div>
          </div>
          
          <div class="project-card">
            <div class="card-header">
              <h2 class="project-title">Westlake Industrial Pond</h2>
              <span class="status-badge badge-inprogress">In Progress</span>
            </div>
            <div class="card-content">
              <div class="project-detail">
                <span class="detail-label">Client:</span>
                <span class="detail-value">Westlake Industries</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Location:</span>
                <span class="detail-value">Westlake, MI</span>
              </div>
              <div class="project-detail">
                <span class="detail-label">Updated:</span>
                <span class="detail-value">May 5, 2025</span>
              </div>
              
              <div class="progress-bar">
                <div class="progress-fill" style="width: 40%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.875rem">
                <span>Progress</span>
                <span>40%</span>
              </div>
            </div>
            <div class="card-footer">
              <a href="/dashboard/projects/5" class="card-button btn-view">View</a>
              <button class="card-button btn-edit">Edit</button>
            </div>
          </div>
        </div>
      </main>
    </body>
    </html>
  `);
});

// Panel Layout Tool
app.get('/dashboard/panel-layout', (req, res) => {
  const panelLayoutPage = fs.readFileSync(path.join(publicDir, 'dashboard/panel-layout.html'), 'utf8');
  res.send(panelLayoutPage);
});

// QC data page
app.get('/dashboard/qc-data', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GeoQC - QC Data</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #f5f8fa;
          color: #334e68;
        }
        header {
          background: white;
          padding: 1rem 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          font-weight: bold;
          font-size: 1.5rem;
          color: #0a2463;
        }
        nav {
          display: flex;
          gap: 1.5rem;
        }
        nav a {
          text-decoration: none;
          color: #486581;
        }
        nav a:hover {
          color: #ff7f11;
        }
        .active {
          color: #0a2463;
          font-weight: 500;
        }
        main {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .button {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .button-primary {
          background: #0a2463;
          color: white;
        }
        .button-primary:hover {
          background: #041640;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .stat-number {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .stat-label {
          color: #627d98;
          font-size: 0.875rem;
        }
        .stat-green {
          color: #36b37e;
        }
        .stat-yellow {
          color: #ffab00;
        }
        .stat-red {
          color: #ff5630;
        }
        .stat-blue {
          color: #0a2463;
        }
        .data-table {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          margin-bottom: 2rem;
        }
        .table-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .table-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #334e68;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid #e9ecef;
        }
        th {
          background: #f8f9fa;
          font-weight: 600;
          color: #627d98;
        }
        tr:last-child td {
          border-bottom: none;
        }
        tr:hover td {
          background: #f0f4f8;
        }
        .status {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .status-pass {
          background: #e3fcef;
          color: #36b37e;
        }
        .status-warning {
          background: #fff7e6;
          color: #ffab00;
        }
        .status-fail {
          background: #ffe8e0;
          color: #ff5630;
        }
        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }
        .icon-button {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #e9ecef;
          transition: all 0.2s;
          cursor: pointer;
        }
        .icon-button:hover {
          background: #f0f4f8;
        }
        .icon-view {
          color: #0a2463;
        }
        .icon-edit {
          color: #ff7f11;
        }
      </style>
    </head>
    <body>
      <header>
        <div class="logo">GeoQC</div>
        <nav>
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/projects">Projects</a>
          <a href="/dashboard/qc-data" class="active">QC Data</a>
          <a href="/dashboard/documents">Documents</a>
          <a href="/settings">Settings</a>
        </nav>
        <div>
          <span>User123</span>
        </div>
      </header>
      
      <main>
        <div class="page-header">
          <h1>Quality Control Data</h1>
          <button class="button button-primary">Upload QC Data</button>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number stat-blue">32</div>
            <div class="stat-label">Total Tests</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-number stat-green">86%</div>
            <div class="stat-label">Pass Rate</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-number stat-yellow">3</div>
            <div class="stat-label">Warnings</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-number stat-red">1</div>
            <div class="stat-label">Failed Tests</div>
          </div>
        </div>
        
        <div class="data-table">
          <div class="table-header">
            <h2 class="table-title">Test Results</h2>
            <div style="display: flex; gap: 1rem">
              <div style="display: flex; border: 1px solid #e9ecef; border-radius: 4px; overflow: hidden">
                <button style="padding: 0.5rem 1rem; border: none; background: #0a2463; color: white; cursor: pointer">All</button>
                <button style="padding: 0.5rem 1rem; border: none; background: white; cursor: pointer">Seam Strength</button>
                <button style="padding: 0.5rem 1rem; border: none; background: white; cursor: pointer">Thickness</button>
                <button style="padding: 0.5rem 1rem; border: none; background: white; cursor: pointer">Density</button>
              </div>
              <button style="padding: 0.5rem 1rem; border: 1px solid #ff7f11; background: white; color: #ff7f11; border-radius: 4px; cursor: pointer">Export CSV</button>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Test ID</th>
                <th>Test Type</th>
                <th>Date</th>
                <th>Location</th>
                <th>Result</th>
                <th>Value</th>
                <th>Operator</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>QC001</td>
                <td>Seam Strength</td>
                <td>May 17, 2025</td>
                <td>North Slope</td>
                <td><span class="status status-pass">Pass</span></td>
                <td>452 lbs</td>
                <td>Michael C.</td>
                <td>
                  <div class="action-buttons">
                    <button class="icon-button icon-view">👁️</button>
                    <button class="icon-button icon-edit">✏️</button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>QC002</td>
                <td>Thickness</td>
                <td>May 16, 2025</td>
                <td>Central Area</td>
                <td><span class="status status-pass">Pass</span></td>
                <td>60 mil</td>
                <td>Sarah J.</td>
                <td>
                  <div class="action-buttons">
                    <button class="icon-button icon-view">👁️</button>
                    <button class="icon-button icon-edit">✏️</button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>QC003</td>
                <td>Density</td>
                <td>May 15, 2025</td>
                <td>East Section</td>
                <td><span class="status status-warning">Warning</span></td>
                <td>0.932 g/cc</td>
                <td>David W.</td>
                <td>
                  <div class="action-buttons">
                    <button class="icon-button icon-view">👁️</button>
                    <button class="icon-button icon-edit">✏️</button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>QC004</td>
                <td>Tear Resistance</td>
                <td>May 18, 2025</td>
                <td>West Edge</td>
                <td><span class="status status-pass">Pass</span></td>
                <td>42 N</td>
                <td>Emma R.</td>
                <td>
                  <div class="action-buttons">
                    <button class="icon-button icon-view">👁️</button>
                    <button class="icon-button icon-edit">✏️</button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>QC005</td>
                <td>Puncture Resistance</td>
                <td>May 14, 2025</td>
                <td>South Corner</td>
                <td><span class="status status-fail">Fail</span></td>
                <td>210 N</td>
                <td>James T.</td>
                <td>
                  <div class="action-buttons">
                    <button class="icon-button icon-view">👁️</button>
                    <button class="icon-button icon-edit">✏️</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style="background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05)">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid #e9ecef; padding-bottom: 1rem">
            <h2 style="margin: 0; font-size: 1.25rem">AI Analysis</h2>
            <div style="color: #627d98; font-size: 0.875rem">Updated 10 minutes ago</div>
          </div>
          
          <div style="margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 1rem">
            <div style="background: #e3fcef; color: #36b37e; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0">✓</div>
            <div>
              <h3 style="margin: 0 0 0.5rem; font-size: 1.125rem">Consistent Performance</h3>
              <p style="margin: 0; color: #627d98">Seam strength tests show consistent results across all tested locations, indicating good installation quality.</p>
            </div>
          </div>
          
          <div style="margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 1rem">
            <div style="background: #fff7e6; color: #ffab00; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0">!</div>
            <div>
              <h3 style="margin: 0 0 0.5rem; font-size: 1.125rem">Potential Concern</h3>
              <p style="margin: 0; color: #627d98">Density readings in the East Section are trending toward the lower acceptable limit. Monitoring recommended.</p>
            </div>
          </div>
          
          <div style="margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 1rem">
            <div style="background: #ffe8e0; color: #ff5630; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0">✗</div>
            <div>
              <h3 style="margin: 0 0 0.5rem; font-size: 1.125rem">Action Required</h3>
              <p style="margin: 0; color: #627d98">Puncture resistance test in South Corner failed to meet minimum requirements. Recommend re-testing and possible material verification.</p>
            </div>
          </div>
          
          <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e9ecef; text-align: center">
            <button class="button button-primary">Generate Detailed Report</button>
          </div>
        </div>
      </main>
    </body>
    </html>
  `);
});

// Route panel optimizer API requests to the Python service
app.use('/api/optimize-panels', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true
}));

app.use('/api/generate-contours', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true
}));

app.use('/api/export-layout', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true
}));

// For other API requests going to the backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true
}));

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Dashboard: http://localhost:${PORT}/dashboard`);
});