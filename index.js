// Professional customer-facing web application

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

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

// Serve static assets with max-age=0 (disable cache)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '0',
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Home page route as a backup in case static serving fails
app.get('/', (req, res) => {
  console.log('Serving index.html through explicit route handler');
  fs.readFile(path.join(__dirname, 'public/index.html'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading index file:', err);
      return res.status(500).send('Error loading home page');
    }
    res.set('Content-Type', 'text/html');
    res.send(data);
  });
});

// Login route
app.get('/login', (req, res) => {
  console.log('Serving login.html through explicit route handler');
  fs.readFile(path.join(__dirname, 'public/login.html'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading login file:', err);
      return res.status(500).send('Error loading login page');
    }
    res.set('Content-Type', 'text/html');
    res.send(data);
  });
});

// Signup route
app.get('/signup', (req, res) => {
  console.log('Serving signup.html through explicit route handler');
  fs.readFile(path.join(__dirname, 'public/signup.html'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading signup file:', err);
      return res.status(500).send('Error loading signup page');
    }
    res.set('Content-Type', 'text/html');
    res.send(data);
  });
});

// Demo route - Hardcoded HTML response
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
        :root {
          --primary: #0052cc;
          --primary-dark: #003d99;
          --secondary: #00857c;
          --light: #f5f8fa;
          --dark: #172b4d;
          --accent: #ff5630;
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
              📊 Dashboard
            </li>
            <li class="sidebar-menu-item">
              <a href="/dashboard/projects" style="color: inherit; text-decoration: none; display: flex; align-items: center; width: 100%;">📋 Projects</a>
            </li>
            <li class="sidebar-menu-item">
              📱 Panel Layout
            </li>
            <li class="sidebar-menu-item">
              📄 QC Data
            </li>
            <li class="sidebar-menu-item">
              📝 Documents
            </li>
            <li class="sidebar-menu-item">
              📈 Reports
            </li>
            <li class="sidebar-menu-item">
              👥 Team Members
            </li>
          </ul>
          
          <div class="sidebar-submenu">
            <div class="sidebar-submenu-title">Admin</div>
            <ul class="sidebar-menu">
              <li class="sidebar-menu-item">
                ⚙️ Settings
              </li>
              <li class="sidebar-menu-item">
                👤 Account
              </li>
              <li class="sidebar-menu-item">
                🔑 Subscription
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
              <div class="stat-card-value">12</div>
              <div class="stat-card-label">
                <span class="trend-up">▲ 2</span> from last month
              </div>
            </div>
            
            <div class="dashboard-card stat-card">
              <div class="stat-card-header">
                <h3 class="stat-card-title">QC Tests</h3>
                <div class="stat-card-icon green">🧪</div>
              </div>
              <div class="stat-card-value">248</div>
              <div class="stat-card-label">
                <span class="trend-up">▲ 12%</span> from last week
              </div>
            </div>
            
            <div class="dashboard-card stat-card">
              <div class="stat-card-header">
                <h3 class="stat-card-title">Documents</h3>
                <div class="stat-card-icon orange">📄</div>
              </div>
              <div class="stat-card-value">56</div>
              <div class="stat-card-label">
                <span class="trend-up">▲ 8</span> new this week
              </div>
            </div>
            
            <div class="dashboard-card stat-card">
              <div class="stat-card-header">
                <h3 class="stat-card-title">Material Usage</h3>
                <div class="stat-card-icon purple">📊</div>
              </div>
              <div class="stat-card-value">86%</div>
              <div class="stat-card-label">
                <span class="trend-up">▲ 3%</span> efficiency increase
              </div>
            </div>
          </div>
          
          <div class="projects-table">
            <div class="table-header">
              <h2 class="table-title">Active Projects</h2>
              <div class="table-actions">
                <button class="btn btn-light">Filter</button>
                <button class="btn">+ New Project</button>
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
                  <td><strong>Landfill Cell 4 Expansion</strong></td>
                  <td>Metro Waste Management</td>
                  <td>Northfield, MN</td>
                  <td><span class="status-badge in-progress">In Progress</span></td>
                  <td>68%</td>
                  <td>2 days ago</td>
                  <td class="table-action">⋯</td>
                </tr>
                <tr>
                  <td><strong>Industrial Retention Pond</strong></td>
                  <td>Ace Manufacturing</td>
                  <td>Detroit, MI</td>
                  <td><span class="status-badge planned">Planned</span></td>
                  <td>32%</td>
                  <td>5 days ago</td>
                  <td class="table-action">⋯</td>
                </tr>
                <tr>
                  <td><strong>Wastewater Treatment Lining</strong></td>
                  <td>PureWater Inc.</td>
                  <td>Tampa, FL</td>
                  <td><span class="status-badge completed">Completed</span></td>
                  <td>94%</td>
                  <td>1 day ago</td>
                  <td class="table-action">⋯</td>
                </tr>
                <tr>
                  <td><strong>Solar Farm Stormwater System</strong></td>
                  <td>SunPeak Energy</td>
                  <td>Phoenix, AZ</td>
                  <td><span class="status-badge in-progress">In Progress</span></td>
                  <td>45%</td>
                  <td>Today</td>
                  <td class="table-action">⋯</td>
                </tr>
                <tr>
                  <td><strong>Highway Embankment Reinforcement</strong></td>
                  <td>State DOT</td>
                  <td>Denver, CO</td>
                  <td><span class="status-badge in-progress">In Progress</span></td>
                  <td>72%</td>
                  <td>3 days ago</td>
                  <td class="table-action">⋯</td>
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
              <div class="chart-placeholder">QC Test Results Chart Visualization</div>
            </div>
            
            <div class="qc-summary">
              <h2 class="chart-title" style="margin-bottom: 1.5rem;">QC Summary</h2>
              
              <div class="summary-item">
                <div class="summary-label">Tests Performed</div>
                <div class="summary-value">248</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Pass Rate</div>
                <div class="summary-value green">96.8%</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Pending Tests</div>
                <div class="summary-value orange">14</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Failed Tests</div>
                <div class="summary-value red">8</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">AI Anomaly Detections</div>
                <div class="summary-value orange">5</div>
              </div>
            </div>
          </div>
          
          <div class="activities-section">
            <h2 class="chart-title" style="margin-bottom: 1rem;">Recent Activities</h2>
            
            <div class="activity-list">
              <div class="activity-item">
                <div class="activity-icon blue">📄</div>
                <div class="activity-content">
                  <div class="activity-text"><strong>Sarah Johnson</strong> uploaded 8 new QC test documents to <strong>Landfill Cell 4 Expansion</strong></div>
                  <div class="activity-time">Today, 10:34 AM</div>
                </div>
              </div>
              
              <div class="activity-item">
                <div class="activity-icon green">✓</div>
                <div class="activity-content">
                  <div class="activity-text"><strong>AI System</strong> completed analysis of 12 density test reports for <strong>Industrial Retention Pond</strong></div>
                  <div class="activity-time">Yesterday, 4:21 PM</div>
                </div>
              </div>
              
              <div class="activity-item">
                <div class="activity-icon orange">⚠️</div>
                <div class="activity-content">
                  <div class="activity-text"><strong>AI Anomaly Detection</strong> identified potential issue with seam strength in <strong>Wastewater Treatment Lining</strong></div>
                  <div class="activity-time">Yesterday, 1:15 PM</div>
                </div>
              </div>
              
              <div class="activity-item">
                <div class="activity-icon blue">📱</div>
                <div class="activity-content">
                  <div class="activity-text"><strong>Mike Peterson</strong> optimized panel layout for <strong>Solar Farm Stormwater System</strong>, reducing material waste by 8%</div>
                  <div class="activity-time">2 days ago</div>
                </div>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 2rem;">
            <a href="/" style="color: var(--primary); text-decoration: none; font-weight: 500;">← Back to Home</a>
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

// Proxy all Next.js related paths to the Next.js application
app.use(['/dashboard', '/_next'], createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    // Log the request for debugging
    console.log(`Proxying ${req.method} ${req.url} to Next.js server at http://localhost:3000`);
  }
}));

// Fallback route for any unhandled routes (must come after all other routes)
app.use((req, res) => {
  console.log(`No route found for ${req.url}, redirecting to home page`);
  res.redirect('/');
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
  console.log(`- Dashboard demo: http://localhost:${PORT}/demo`);
  console.log(`- Next.js Dashboard: http://localhost:${PORT}/dashboard`);
});