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


// Define the public directory path

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

// Projects page is now handled directly by the Next.js app
// No special handler needed as it's included in the proxy middleware

// Free trial route - Replace the old demo with a functional version
// This provides the same UI as the demo but with empty states for real user input
app.get('/free-trial', (req, res) => {
  console.log('Serving functional dashboard with empty state UI');
  
  // Get plan from query parameter if available
  const plan = req.query.plan || 'basic';
  console.log('Selected plan:', plan);
  
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GeoSynth QC Pro - Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root {
          --primary: #003366;  /* Navy blue */
          --primary-dark: #002244;
          --secondary: #ff9933; /* Orange */
          --light: #f5f8fa;
          --dark: #172b4d;
          --accent: #ff6633;
          --gray: #6b778c;
          --success: #36b37e;
          --warning: #ffab00;
          --error: #ff5630;
          --border: #dfe1e6;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: var(--dark);
          background-color: var(--light);
          height: 100vh;
          overflow: hidden;
        }
        
        .dashboard {
          display: grid;
          grid-template-columns: 260px 1fr;
          grid-template-rows: 60px 1fr;
          grid-template-areas: 
            "sidebar header"
            "sidebar main";
          height: 100vh;
        }
        
        .header {
          grid-area: header;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }
        
        .search-container {
          position: relative;
          width: 300px;
        }
        
        .search-input {
          width: 100%;
          padding: 0.5rem 1rem 0.5rem 2.5rem;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .search-icon {
          position: absolute;
          left: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray);
        }
        
        .user-nav {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        
        .nav-icon {
          color: var(--gray);
          cursor: pointer;
          position: relative;
        }
        
        .nav-icon:hover {
          color: var(--primary);
        }
        
        .notifications-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background-color: var(--accent);
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          cursor: pointer;
        }
        
        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        
        .user-name {
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .sidebar {
          grid-area: sidebar;
          background-color: var(--dark);
          color: white;
          padding: 2rem 0;
          overflow-y: auto;
        }
        
        .sidebar-brand {
          padding: 0 2rem;
          margin-bottom: 2rem;
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .sidebar-brand span {
          color: var(--secondary);
        }
        
        .sidebar-menu {
          list-style: none;
        }
        
        .sidebar-menu-item {
          padding: 0.8rem 2rem;
          cursor: pointer;
          transition: background-color 0.3s;
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        
        .sidebar-menu-item:hover {
          background-color: rgba(255,255,255,0.1);
        }
        
        .sidebar-menu-item.active {
          background-color: var(--primary);
          font-weight: 500;
        }
        
        .sidebar-submenu {
          margin-top: 2rem;
        }
        
        .sidebar-submenu-title {
          padding: 0 2rem;
          text-transform: uppercase;
          font-size: 0.8rem;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          margin-bottom: 0.5rem;
        }
        
        .main {
          grid-area: main;
          padding: 2rem;
          overflow-y: auto;
        }
        
        .page-title {
          margin-bottom: 2rem;
          font-size: 1.8rem;
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .dashboard-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
          padding: 1.5rem;
        }
        
        .stat-card {
          display: flex;
          flex-direction: column;
        }
        
        .stat-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        
        .stat-card-title {
          font-size: 1rem;
          color: var(--gray);
        }
        
        .stat-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        
        .stat-card-icon.blue {
          background-color: var(--primary);
        }
        
        .stat-card-icon.green {
          background-color: var(--success);
        }
        
        .stat-card-icon.orange {
          background-color: var(--warning);
        }
        
        .stat-card-icon.purple {
          background-color: #5243aa;
        }
        
        .stat-card-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        
        .stat-card-label {
          font-size: 0.9rem;
          color: var(--gray);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .trend-up {
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 0.2rem;
        }
        
        .trend-down {
          color: var(--error);
          display: flex;
          align-items: center;
          gap: 0.2rem;
        }
        
        .projects-table {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
          overflow: hidden;
          margin-bottom: 2rem;
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        
        .table-title {
          font-size: 1.2rem;
          font-weight: 600;
        }
        
        .table-actions {
          display: flex;
          gap: 1rem;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background-color: var(--primary);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.9rem;
          border: none;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .btn:hover {
          background-color: var(--primary-dark);
        }
        
        .btn-light {
          background-color: white;
          color: var(--dark);
          border: 1px solid var(--border);
        }
        
        .btn-light:hover {
          background-color: var(--light);
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th {
          text-align: left;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
          font-weight: 600;
          color: var(--gray);
          font-size: 0.9rem;
        }
        
        td {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.95rem;
        }
        
        tr:last-child td {
          border-bottom: none;
        }
        
        .status-badge {
          display: inline-block;
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .status-badge.completed {
          background-color: rgba(54, 179, 126, 0.1);
          color: var(--success);
        }
        
        .status-badge.in-progress {
          background-color: rgba(255, 171, 0, 0.1);
          color: var(--warning);
        }
        
        .status-badge.planned {
          background-color: rgba(0, 82, 204, 0.1);
          color: var(--primary);
        }
        
        .table-action {
          color: var(--gray);
          cursor: pointer;
          transition: color 0.3s;
        }
        
        .table-action:hover {
          color: var(--primary);
        }
        
        .qc-data-section {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .chart-container {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
          padding: 1.5rem;
        }
        
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        
        .chart-title {
          font-size: 1.2rem;
          font-weight: 600;
        }
        
        .chart-filters {
          display: flex;
          gap: 0.8rem;
        }
        
        .filter-pill {
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          background-color: var(--light);
          color: var(--gray);
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .filter-pill:hover {
          background-color: #e9ecef;
        }
        
        .filter-pill.active {
          background-color: var(--primary);
          color: white;
        }
        
        .chart-placeholder {
          height: 220px;
          background-color: var(--light);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray);
        }
        
        .qc-summary {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
          padding: 1.5rem;
        }
        
        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
        }
        
        .summary-item:last-child {
          border-bottom: none;
        }
        
        .summary-label {
          font-weight: 500;
        }
        
        .summary-value {
          font-weight: 600;
        }
        
        .summary-value.green {
          color: var(--success);
        }
        
        .summary-value.orange {
          color: var(--warning);
        }
        
        .summary-value.red {
          color: var(--error);
        }
        
        .activities-section {
          margin-bottom: 2rem;
        }
        
        .activity-list {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
          padding: 1.5rem;
        }
        
        .activity-item {
          display: flex;
          gap: 1.5rem;
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
        }
        
        .activity-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        
        .activity-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        
        .activity-icon.blue {
          background-color: var(--primary);
        }
        
        .activity-icon.green {
          background-color: var(--success);
        }
        
        .activity-icon.orange {
          background-color: var(--warning);
        }
        
        .activity-content {
          flex-grow: 1;
        }
        
        .activity-text {
          margin-bottom: 0.3rem;
        }
        
        .activity-text strong {
          font-weight: 600;
        }
        
        .activity-time {
          font-size: 0.85rem;
          color: var(--gray);
        }
        
        @media (max-width: 1200px) {
          .qc-data-section {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .dashboard {
            grid-template-columns: 1fr;
            grid-template-areas: 
              "header"
              "main";
          }
          
          .sidebar {
            display: none;
          }
          
          .header {
            padding: 0 1rem;
          }
          
          .search-container {
            width: 180px;
          }
          
          .user-name {
            display: none;
          }
          
          .main {
            padding: 1rem;
          }
          
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <header class="header">
          <div class="search-container">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" placeholder="Search...">
          </div>
          <div class="user-nav">
            <div class="nav-icon">
              📋
            </div>
            <div class="nav-icon">
              📊
            </div>
            <div class="nav-icon">
              🔔
              <span class="notifications-badge">3</span>
            </div>
            <div class="user-info">
              <div class="user-avatar">JD</div>
              <div class="user-name">John Doe</div>
            </div>
          </div>
        </header>
        
        <aside class="sidebar">
          <div class="sidebar-brand">
            Geo<span>Synth</span> QC Pro
          </div>
          
          <ul class="sidebar-menu">
            <li class="sidebar-menu-item active">
              <a href="/dashboard" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">📊 Dashboard</a>
            </li>
            <li class="sidebar-menu-item">
              <a href="/dashboard/projects" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">📋 Projects</a>
            </li>
            <li class="sidebar-menu-item">
              <a href="/dashboard/panels" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">📱 Panel Layout</a>
            </li>
            <li class="sidebar-menu-item">
              <a href="/dashboard/qc-data" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">📄 QC Data</a>
            </li>
            <li class="sidebar-menu-item">
              <a href="/dashboard/documents" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">📝 Documents</a>
            </li>
            <li class="sidebar-menu-item">
              <a href="/dashboard/reports" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">📈 Reports</a>
            </li>
            <li class="sidebar-menu-item">
              <a href="/dashboard/team" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">👥 Team Members</a>
            </li>
          </ul>
          
          <div class="sidebar-submenu">
            <div class="sidebar-submenu-title">Admin</div>
            <ul class="sidebar-menu">
              <li class="sidebar-menu-item">
                <a href="/dashboard/settings" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">⚙️ Settings</a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/dashboard/account" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">👤 Account</a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/dashboard/subscription" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">🔑 Subscription</a>
              </li>
            </ul>
          </div>
        </aside>
        
        <main class="main">
          <h1 class="page-title">Dashboard</h1>
          
          <div class="dashboard-grid">
            <div class="dashboard-card stat-card">
              <div class="stat-card-header">
                <h3 class="stat-card-title">Active Projects</h3>
                <div class="stat-card-icon blue">📋</div>
              </div>
              <div class="stat-card-value">0</div>
              <div class="stat-card-label">
                <span class="trend-neutral">—</span> No data yet
              </div>
            </div>
            
            <div class="dashboard-card stat-card">
              <div class="stat-card-header">
                <h3 class="stat-card-title">QC Tests</h3>
                <div class="stat-card-icon green">🧪</div>
              </div>
              <div class="stat-card-value">0</div>
              <div class="stat-card-label">
                <span class="trend-neutral">—</span> No data yet
              </div>
            </div>
            
            <div class="dashboard-card stat-card">
              <div class="stat-card-header">
                <h3 class="stat-card-title">Documents</h3>
                <div class="stat-card-icon orange">📄</div>
              </div>
              <div class="stat-card-value">0</div>
              <div class="stat-card-label">
                <span class="trend-neutral">—</span> No data yet
              </div>
            </div>
            
            <div class="dashboard-card stat-card">
              <div class="stat-card-header">
                <h3 class="stat-card-title">Material Usage</h3>
                <div class="stat-card-icon purple">📊</div>
              </div>
              <div class="stat-card-value">0%</div>
              <div class="stat-card-label">
                <span class="trend-neutral">—</span> No data yet
              </div>
            </div>
          </div>
          
          <div class="projects-table">
            <div class="table-header">
              <h2 class="table-title">Active Projects</h2>
              <div class="table-actions">
                <button class="btn btn-light">Filter</button>
                <a href="/dashboard/projects/new" class="btn">+ New Project</a>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>QC Progress</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2rem;">
                    <div>
                      <h3 style="margin-bottom: 1rem; color: var(--gray);">No projects yet</h3>
                      <p style="margin-bottom: 1.5rem; color: var(--gray);">Click the button above to add your first project</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="qc-data-section">
            <div class="chart-container">
              <div class="chart-header">
                <h2 class="chart-title">QC Test Results</h2>
                <div class="chart-filters">
                  <div class="filter-pill active">All Tests</div>
                  <div class="filter-pill">Density</div>
                  <div class="filter-pill">Thickness</div>
                  <div class="filter-pill">Peel</div>
                </div>
              </div>
              <div class="chart-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; text-align: center; color: var(--gray); border: 1px dashed var(--border); border-radius: 8px; padding: 2rem;">
                <h3 style="margin-bottom: 1rem;">No QC test data available</h3>
                <p style="margin-bottom: 1rem;">Upload test data to see visualization here</p>
                <a href="/dashboard/qc-data/upload" class="btn">Upload QC Data</a>
              </div>
            </div>
            
            <div class="qc-summary">
              <h2 class="chart-title" style="margin-bottom: 1.5rem;">QC Summary</h2>
              
              <div class="summary-item">
                <div class="summary-label">Tests Performed</div>
                <div class="summary-value">0</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Pass Rate</div>
                <div class="summary-value">0%</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Pending Tests</div>
                <div class="summary-value">0</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Failed Tests</div>
                <div class="summary-value">0</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">AI Anomaly Detections</div>
                <div class="summary-value">0</div>
              </div>
            </div>
          </div>
          
          <div class="activities-section">
            <h2 class="chart-title" style="margin-bottom: 1rem;">Recent Activities</h2>
            
            <div class="activity-list">
              <div style="text-align: center; padding: 2rem; color: var(--gray);">
                <div style="margin-bottom: 1rem; font-size: 3rem;">📋</div>
                <h3 style="margin-bottom: 1rem;">No activities yet</h3>
                <p style="margin-bottom: 1.5rem;">Activities will appear here as you and your team work on projects</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 2rem;">
            <a href="/dashboard" style="display: inline-block; margin-right: 1rem; color: var(--primary); text-decoration: none; font-weight: 500;">← Back to Dashboard</a>
            <a href="/dashboard/subscription" class="btn" style="margin-left: 1rem;">Upgrade Subscription</a>
          </div>
        </main>
      </div>
    </body>
    </html>
  `);
});

// API endpoint mock
app.post('/api/contact', (req, res) => {
  console.log('Contact form submission received');
  res.json({ success: true, message: 'Thank you for contacting us!' });
});

// Proxy Next.js app requests (This captures ALL Next.js related routes)
// Any paths that start with these will be directed to the Next.js app
const nextJsRoutes = [
  '/dashboard', 
  '/projects',
  '/_next', 
  '/static', 
  '/subscription',
  '/account',
  '/api',
  '/app',
  '/__nextjs'
];

// Direct projects page requests to the Next.js frontend
app.get('/dashboard/projects', (req, res) => {
  console.log('Proxying to frontend server: dashboard/projects');
  res.redirect('http://localhost:3000/dashboard/projects');
});
          --primary: #003366;  /* Navy blue */
          --primary-dark: #002244;
          --secondary: #ff9933; /* Orange */
          --light: #f5f8fa;
          --dark: #172b4d;
          --accent: #ff6633;
          --gray: #6b778c;
          --success: #36b37e;
          --warning: #ffab00;
          --error: #ff5630;
          --border: #dfe1e6;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
          background-color: #f5f8fa;
          color: #172b4d;
          line-height: 1.6;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
        }
        
        /* Navigation */
        .navbar {
          background-color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          height: 64px;
          display: flex;
          align-items: center;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
        }
        
        .navbar-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        
        .logo {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
          display: flex;
          align-items: center;
        }
        
        .logo span {
          color: var(--secondary);
        }
        
        .nav-user {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }
        
        /* Layout */
        .layout {
          display: flex;
          min-height: 100vh;
          padding-top: 64px; /* Navbar height */
        }
        
        /* Sidebar */
        .sidebar {
          width: 240px;
          background-color: var(--dark);
          color: white;
          position: fixed;
          top: 64px;
          bottom: 0;
          overflow-y: auto;
          z-index: 50;
        }
        
        .sidebar-menu {
          padding: 1.5rem 0;
        }
        
        .menu-item {
          padding: 0.75rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          color: rgba(255,255,255,0.8);
          text-decoration: none;
        }
        
        .menu-item:hover {
          background-color: rgba(255,255,255,0.1);
          color: white;
        }
        
        .menu-item.active {
          background-color: var(--primary);
          color: white;
          font-weight: 500;
        }
        
        .menu-section {
          padding: 0.5rem 1.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          margin-top: 1.5rem;
        }
        
        /* Main Content */
        .main {
          flex: 1;
          margin-left: 240px;
          padding: 2rem;
        }
        
        .page-header {
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .page-title {
          font-size: 1.8rem;
          font-weight: 600;
          color: var(--dark);
        }
        
        /* Project Cards Grid */
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .project-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .project-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .project-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .project-title {
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--dark);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 65%;
        }
        
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-block;
        }
        
        .status-active {
          background-color: rgba(54, 179, 126, 0.1);
          color: var(--success);
          border: 1px solid var(--success);
        }
        
        .status-completed {
          background-color: rgba(0, 82, 204, 0.1);
          color: #0052cc;
          border: 1px solid #0052cc;
        }
        
        .status-onhold {
          background-color: rgba(255, 171, 0, 0.1);
          color: var(--warning);
          border: 1px solid var(--warning);
        }
        
        .status-delayed {
          background-color: rgba(255, 86, 48, 0.1);
          color: var(--error);
          border: 1px solid var(--error);
        }
        
        .project-content {
          padding: 1.25rem;
          flex-grow: 1;
        }
        
        .project-meta {
          margin-bottom: 1rem;
          font-size: 0.85rem;
          color: var(--gray);
        }
        
        .progress-section {
          margin-bottom: 1rem;
        }
        
        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        
        .progress-bar {
          height: 6px;
          background-color: #f0f2f5;
          border-radius: 3px;
          overflow: hidden;
        }
        
        .progress-value {
          height: 100%;
          border-radius: 3px;
        }
        
        .progress-low {
          background-color: var(--error);
        }
        
        .progress-medium {
          background-color: var(--warning);
        }
        
        .progress-high {
          background-color: var(--success);
        }
        
        .project-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        
        .info-badge {
          background-color: #f0f2f5;
          color: var(--gray);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .project-actions {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border);
          background-color: #fafbfc;
          display: flex;
          justify-content: space-between;
        }
        
        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }
        
        .btn {
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          text-decoration: none;
        }
        
        .btn-primary {
          background-color: var(--primary);
          color: white;
          border: none;
        }
        
        .btn-primary:hover {
          background-color: var(--primary-dark);
        }
        
        .btn-secondary {
          background-color: white;
          color: var(--primary);
          border: 1px solid var(--primary);
        }
        
        .btn-secondary:hover {
          background-color: #f0f7ff;
        }
        
        .btn-outline {
          background-color: white;
          color: var(--gray);
          border: 1px solid var(--border);
        }
        
        .btn-outline:hover {
          background-color: #f5f8fa;
        }
      </style>
    </head>
    <body>
      <!-- Navigation Bar -->
      <div class="navbar">
        <div class="container navbar-content">
          <div class="logo">
            Geo<span>QC</span>
          </div>
          <div class="nav-user">
            <div class="user-info">
              <div class="user-avatar">JD</div>
              <span>John Doe</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Main Layout -->
      <div class="layout">
        <!-- Sidebar -->
        <div class="sidebar">
          <div class="sidebar-menu">
            <a href="/dashboard" class="menu-item">
              📊 Dashboard
            </a>
            <a href="/dashboard/projects" class="menu-item active">
              📋 Projects
            </a>
            <a href="/dashboard/panels" class="menu-item">
              📱 Panel Layout
            </a>
            <a href="/dashboard/qc-data" class="menu-item">
              📄 QC Data
            </a>
            <a href="/dashboard/documents" class="menu-item">
              📝 Documents
            </a>
            <a href="/dashboard/reports" class="menu-item">
              📈 Reports
            </a>
            
            <div class="menu-section">Administration</div>
            <a href="/dashboard/team" class="menu-item">
              👥 Team Members
            </a>
            <a href="/dashboard/settings" class="menu-item">
              ⚙️ Settings
            </a>
            <a href="/dashboard/account" class="menu-item">
              👤 Account
            </a>
            <a href="/dashboard/subscription" class="menu-item">
              🔑 Subscription
            </a>
          </div>
        </div>
        
        <!-- Main Content -->
        <div class="main">
          <div class="page-header">
            <h1 class="page-title">Projects</h1>
          </div>
          
          <!-- Projects Grid -->
          <div class="projects-grid">
            <!-- Project Card 1 -->
            <div class="project-card">
              <div class="project-header">
                <h3 class="project-title">Lakeview Containment Facility</h3>
                <span class="status-badge status-active">Active</span>
              </div>
              <div class="project-content">
                <div class="project-meta">
                  Last updated: May 20, 2025
                </div>
                <div class="progress-section">
                  <div class="progress-header">
                    <span>Progress</span>
                    <span>35%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-value progress-medium" style="width: 35%"></div>
                  </div>
                </div>
                <div class="project-badges">
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    3 docs
                  </div>
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    5 comments
                  </div>
                </div>
              </div>
              <div class="project-actions">
                <div class="action-buttons">
                  <a href="/dashboard/projects/1" class="btn btn-primary">View</a>
                  <a href="/dashboard/projects/1/panel-layout" class="btn btn-secondary">Layout</a>
                </div>
                <button onclick="openEditModal('1', 'Lakeview Containment Facility', 'Active', '35')" class="btn btn-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
              </div>
            </div>
            
            <!-- Project Card 2 -->
            <div class="project-card">
              <div class="project-header">
                <h3 class="project-title">Riverside Dam Liner</h3>
                <span class="status-badge status-completed">Completed</span>
              </div>
              <div class="project-content">
                <div class="project-meta">
                  Last updated: May 13, 2025
                </div>
                <div class="progress-section">
                  <div class="progress-header">
                    <span>Progress</span>
                    <span>100%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-value progress-high" style="width: 100%"></div>
                  </div>
                </div>
                <div class="project-badges">
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    8 docs
                  </div>
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    12 comments
                  </div>
                </div>
              </div>
              <div class="project-actions">
                <div class="action-buttons">
                  <a href="/dashboard/projects/2" class="btn btn-primary">View</a>
                  <a href="/dashboard/projects/2/panel-layout" class="btn btn-secondary">Layout</a>
                </div>
                <button onclick="openEditModal('2', 'Riverside Dam Liner', 'Completed', '100')" class="btn btn-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
              </div>
            </div>
            
            <!-- Project Card 3 -->
            <div class="project-card">
              <div class="project-header">
                <h3 class="project-title">Mountain Creek Landfill</h3>
                <span class="status-badge status-onhold">On Hold</span>
              </div>
              <div class="project-content">
                <div class="project-meta">
                  Last updated: May 17, 2025
                </div>
                <div class="progress-section">
                  <div class="progress-header">
                    <span>Progress</span>
                    <span>68%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-value progress-high" style="width: 68%"></div>
                  </div>
                </div>
                <div class="project-badges">
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    5 docs
                  </div>
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    3 comments
                  </div>
                </div>
              </div>
              <div class="project-actions">
                <div class="action-buttons">
                  <a href="/dashboard/projects/3" class="btn btn-primary">View</a>
                  <a href="/dashboard/projects/3/panel-layout" class="btn btn-secondary">Layout</a>
                </div>
                <button onclick="openEditModal('3', 'Mountain Creek Landfill', 'On Hold', '68')" class="btn btn-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
              </div>
            </div>
            
            <!-- Project Card 4 -->
            <div class="project-card">
              <div class="project-header">
                <h3 class="project-title">Desert Solar Farm</h3>
                <span class="status-badge status-delayed">Delayed</span>
              </div>
              <div class="project-content">
                <div class="project-meta">
                  Last updated: May 6, 2025
                </div>
                <div class="progress-section">
                  <div class="progress-header">
                    <span>Progress</span>
                    <span>22%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-value progress-low" style="width: 22%"></div>
                  </div>
                </div>
                <div class="project-badges">
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    2 docs
                  </div>
                  <div class="info-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    7 comments
                  </div>
                </div>
              </div>
              <div class="project-actions">
                <div class="action-buttons">
                  <a href="/dashboard/projects/4" class="btn btn-primary">View</a>
                  <a href="/dashboard/projects/4/panel-layout" class="btn btn-secondary">Layout</a>
                </div>
                <button onclick="openEditModal('4', 'Desert Solar Farm', 'Delayed', '22')" class="btn btn-outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Edit Project Modal -->
      <div id="editProjectModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 1000; overflow: auto;">
        <div style="background-color: white; margin: 10% auto; padding: 20px; border-radius: 8px; width: 80%; max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
          <span onclick="closeEditModal()" style="color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
          <h2 style="margin-bottom: 20px; color: var(--primary);">Edit Project</h2>
          
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <input type="hidden" id="projectId">
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 500; color: var(--dark);">Project Name</label>
              <input type="text" id="projectName" style="padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border); font-size: 14px;">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 500; color: var(--dark);">Status</label>
              <select id="projectStatus" style="padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border); font-size: 14px; background-color: white;">
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
                <option value="Delayed">Delayed</option>
              </select>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 500; color: var(--dark);">Progress (%)</label>
              <input type="number" id="projectProgress" min="0" max="100" style="padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border); font-size: 14px;">
            </div>
            
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
              <button type="button" onclick="closeEditModal()" style="padding: 8px 16px; border-radius: 4px; border: 1px solid var(--border); background-color: white; cursor: pointer;">Cancel</button>
              <button type="button" onclick="saveProjectChanges()" style="padding: 8px 16px; border-radius: 4px; border: none; background-color: var(--primary); color: white; cursor: pointer;">Save Changes</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast Notification -->
      <div id="toast" style="visibility: hidden; position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background-color: #333; color: white; padding: 16px; border-radius: 4px; min-width: 250px; text-align: center; z-index: 1001; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
        Project updated successfully!
      </div>
      
      <script>
        // Modal Functionality
        function openEditModal(id, name, status, progress) {
          document.getElementById('projectId').value = id;
          document.getElementById('projectName').value = name;
          document.getElementById('projectStatus').value = status;
          document.getElementById('projectProgress').value = progress;
          document.getElementById('editProjectModal').style.display = 'block';
        }
        
        function closeEditModal() {
          document.getElementById('editProjectModal').style.display = 'none';
        }
        
 function saveProjectChanges() { {
          // Get form values
          const id = document.getElementById('projectId').value;
          const name = document.getElementById('projectName').value;
          const status = document.getElementById('projectStatus').value;
          const progress = document.getElementById('projectProgress').value;
          
          // Find the project card containing the button that was clicked
          let projectCard;
          const allCards = document.querySelectorAll('.project-card');
          
          for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            if (card.querySelector('.btn-outline').getAttribute('onclick').includes(id)) {
              projectCard = card;
              break;
            }
          }
          
          if (!projectCard) return;
          
          // Update project card with new values
          projectCard.querySelector('.project-title').textContent = name;
          
          // Update status badge
          const statusBadge = projectCard.querySelector('.status-badge');
          statusBadge.textContent = status;
          
          // Update status badge class
          statusBadge.className = 'status-badge';
          if (status === 'Active') {
            statusBadge.classList.add('status-active');
          } else if (status === 'Completed') {
            statusBadge.classList.add('status-completed');
          } else if (status === 'On Hold') {
            statusBadge.classList.add('status-onhold');
          } else if (status === 'Delayed') {
            statusBadge.classList.add('status-delayed');
          }
          
          // Update progress
          const progressText = projectCard.querySelector('.progress-header span:last-child');
          const progressBar = projectCard.querySelector('.progress-value');
          
          progressText.textContent = progress + '%';
          progressBar.style.width = progress + '%';
          
          // Update progress bar color
          progressBar.className = 'progress-value';
          if (progress < 30) {
            progressBar.classList.add('progress-low');
          } else if (progress < 70) {
            progressBar.classList.add('progress-medium');
          } else {
            progressBar.classList.add('progress-high');
          }
          
          // Update the edit button onclick attribute
          const editButton = projectCard.querySelector('.btn-outline');
          editButton.setAttribute('onclick', `openEditModal('${id}', '${name}', '${status}', '${progress}')`);
          
          // Show success toast
          const toast = document.getElementById('toast');
          toast.style.visibility = 'visible';
          
          // Hide toast after 3 seconds
          setTimeout(function() {
            toast.style.visibility = 'hidden';
          }, 3000);
          
          // Close modal
          closeEditModal();
        }
        
        // Close modal when clicking outside of it
        window.onclick = function(event) {
          const modal = document.getElementById('editProjectModal');
          if (event.target === modal) {
            closeEditModal();
          }
}
      </script>
    </body>
    </html>
  `);
});

// Check if the URL path starts with any of the Next.js routes
app.use((req, res, next) => {
  const isNextJsRoute = nextJsRoutes.some(route => req.path.startsWith(route));
  
  if (isNextJsRoute) {
    console.log(`Gateway Server: Proxying to Next.js app: ${req.method} ${req.url}`);
    const proxy = createProxyMiddleware({
      target: 'http://localhost:3000',
      changeOrigin: true,
      ws: true,
      // Add error handling
      onError: (err, req, res) => {
        console.error('Next.js proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end('Next.js server error, please try again');
      },
      // Enhance proxy connection handling 
      onProxyRes: (proxyRes, req, res) => {
        proxyRes.headers['Connection'] = 'keep-alive';
        console.log(`Next.js proxy response: ${proxyRes.statusCode} for ${req.url}`);
      },
      // Handle Replit environment
      hostRewrite: true,
      autoRewrite: true,
      secure: false,
    });
    return proxy(req, res, next);
  }
  
  // Not a Next.js route, continue to the next middleware
  console.log(`Not a Next.js route: ${req.method} ${req.url}`);
  next();
});

// Proxy API requests to the backend server
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Gateway Server: Proxying API ${req.method} ${req.url} to Backend server`);
  }
}));

// Fallback route for any unhandled routes (must come after all other routes)
app.use((req, res) => {
  // Check if the request is for an HTML page
  const isHtmlRequest = req.headers.accept && 
                       req.headers.accept.includes('text/html') && 
                       !req.url.includes('.');
  
  console.log(`No route found for ${req.url}, ${isHtmlRequest ? 'serving index page' : 'returning 404'}`);
  
  if (isHtmlRequest) {
    // For HTML requests, serve the index.html page
    res.sendFile(path.join(publicDir, 'index.html'));
  } else {
    // For other requests (like API calls, missing resources), return 404
    res.status(404).send('Not Found');
  }
});

// Handle errors
app.use((err, req, res, next) => {
  console.error('Error caught:', err.stack);
  res.status(500).send('Something went wrong!');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Main site: http://localhost:${PORT}/`);
  console.log(`- Login page: http://localhost:${PORT}/login`);
  console.log(`- Signup page: http://localhost:${PORT}/signup`);
  console.log(`- Free trial dashboard: http://localhost:${PORT}/free-trial`);
  console.log(`- Next.js Dashboard: http://localhost:${PORT}/dashboard`);
});