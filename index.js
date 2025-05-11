// Professional customer-facing web application

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Login route
app.get('/login', (req, res) => {
  fs.readFile(path.join(__dirname, 'public/login.html'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading login file:', err);
      return res.status(500).send('Error loading login page');
    }
    res.send(data);
  });
});

// Signup route
app.get('/signup', (req, res) => {
  fs.readFile(path.join(__dirname, 'public/signup.html'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading signup file:', err);
      return res.status(500).send('Error loading signup page');
    }
    res.send(data);
  });
});

// Create a professional customer-facing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GeoSynth QC Pro - Professional Quality Control for Geosynthetic Projects</title>
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
        }
        
        header {
          background-color: white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          max-width: 1300px;
          margin: 0 auto;
        }
        
        .logo {
          display: flex;
          align-items: center;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }
        
        .logo span {
          color: var(--secondary);
        }
        
        nav ul {
          display: flex;
          list-style: none;
        }
        
        nav ul li {
          margin-left: 2rem;
        }
        
        nav ul li a {
          text-decoration: none;
          color: var(--dark);
          font-weight: 500;
          transition: color 0.3s;
          border-bottom: 2px solid transparent;
          padding-bottom: 0.3rem;
        }
        
        nav ul li a:hover {
          color: var(--primary);
          border-bottom: 2px solid var(--primary);
        }
        
        .hero {
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          color: white;
          padding: 5rem 2rem;
          text-align: center;
        }
        
        .hero-container {
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .hero h1 {
          font-size: 2.8rem;
          margin-bottom: 1.5rem;
          line-height: 1.2;
        }
        
        .hero p {
          font-size: 1.25rem;
          margin-bottom: 2.5rem;
          opacity: 0.9;
        }
        
        .btn {
          display: inline-block;
          background-color: var(--primary);
          color: white;
          padding: 0.8rem 2rem;
          border-radius: 4px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s;
          border: none;
          cursor: pointer;
          font-size: 1rem;
        }
        
        .btn:hover {
          background-color: var(--primary-dark);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-light {
          background-color: white;
          color: var(--primary);
        }
        
        .btn-light:hover {
          background-color: var(--light);
        }
        
        .btn-cta {
          background-color: var(--accent);
          padding: 1rem 2.5rem;
          font-size: 1.1rem;
        }
        
        .btn-group {
          display: flex;
          gap: 1.5rem;
          justify-content: center;
        }
        
        section {
          padding: 5rem 2rem;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .section-title {
          text-align: center;
          margin-bottom: 3rem;
        }
        
        .section-title h2 {
          font-size: 2.2rem;
          color: var(--dark);
          position: relative;
          margin-bottom: 1.5rem;
        }
        
        .section-title h2::after {
          content: '';
          position: absolute;
          bottom: -15px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 3px;
          background-color: var(--primary);
        }
        
        .section-title p {
          color: var(--gray);
          font-size: 1.2rem;
          max-width: 700px;
          margin: 0 auto;
        }
        
        .features {
          background-color: white;
        }
        
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2.5rem;
        }
        
        .feature-card {
          background-color: var(--light);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        
        .feature-icon {
          background-color: var(--primary);
          height: 8px;
          width: 100%;
        }
        
        .feature-icon.ai {
          background-color: #5243aa;
        }
        
        .feature-icon.design {
          background-color: var(--secondary);
        }
        
        .feature-icon.data {
          background-color: #ff8b00;
        }
        
        .feature-content {
          padding: 1.5rem;
        }
        
        .feature-content h3 {
          font-size: 1.3rem;
          margin-bottom: 1rem;
          color: var(--dark);
        }
        
        .feature-content p {
          color: var(--gray);
          margin-bottom: 1.5rem;
        }
        
        .cta-section {
          background-color: var(--primary);
          color: white;
          text-align: center;
          padding: 4rem 2rem;
        }
        
        .cta-section h2 {
          font-size: 2.2rem;
          margin-bottom: 1rem;
        }
        
        .cta-section p {
          font-size: 1.2rem;
          margin-bottom: 2rem;
          opacity: 0.9;
        }
        
        .pricing {
          background-color: var(--light);
        }
        
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          justify-content: center;
        }
        
        .pricing-card {
          background-color: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          transition: transform 0.3s;
          position: relative;
        }
        
        .pricing-card:hover {
          transform: translateY(-10px);
        }
        
        .pricing-card.highlight {
          border: 2px solid var(--primary);
          transform: scale(1.05);
        }
        
        .pricing-card.highlight:hover {
          transform: scale(1.05) translateY(-10px);
        }
        
        .pricing-header {
          padding: 2rem;
          text-align: center;
          border-bottom: 1px solid #eee;
        }
        
        .pricing-header h3 {
          font-size: 1.8rem;
          margin-bottom: 0.5rem;
        }
        
        .pricing-price {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: var(--primary);
        }
        
        .pricing-price span {
          font-size: 1rem;
          font-weight: 400;
          color: var(--gray);
        }
        
        .popular-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: var(--accent);
          color: white;
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        .pricing-features {
          padding: 2rem;
        }
        
        .pricing-features ul {
          list-style: none;
        }
        
        .pricing-features li {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
          position: relative;
        }
        
        .pricing-features li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: var(--success);
          font-weight: bold;
        }
        
        .pricing-action {
          padding: 0 2rem 2rem;
          text-align: center;
        }
        
        .testimonials {
          background-color: white;
        }
        
        .testimonial-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }
        
        .testimonial-card {
          background-color: var(--light);
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        .testimonial-text {
          margin-bottom: 1.5rem;
          font-style: italic;
          color: var(--dark);
        }
        
        .testimonial-author {
          display: flex;
          align-items: center;
        }
        
        .testimonial-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background-color: #ddd;
          margin-right: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: var(--primary);
        }
        
        .testimonial-info h4 {
          font-size: 1.1rem;
          margin-bottom: 0.2rem;
        }
        
        .testimonial-info p {
          color: var(--gray);
          font-size: 0.9rem;
        }
        
        .contact {
          background-color: var(--dark);
          color: white;
        }
        
        .contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 3rem;
        }
        
        .contact-form {
          background-color: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: var(--dark);
        }
        
        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 0.8rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: inherit;
          font-size: 1rem;
        }
        
        .form-group textarea {
          min-height: 120px;
          resize: vertical;
        }
        
        .contact-info {
          padding: 2rem;
        }
        
        .contact-info h3 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
        }
        
        .contact-method {
          margin-bottom: 2rem;
        }
        
        .contact-method h4 {
          font-size: 1.2rem;
          margin-bottom: 0.8rem;
        }
        
        .contact-method p {
          opacity: 0.8;
        }
        
        footer {
          background-color: var(--dark);
          color: white;
          padding: 2rem;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        
        footer p {
          opacity: 0.7;
          font-size: 0.9rem;
        }
        
        .login-form {
          max-width: 450px;
          margin: 4rem auto;
          padding: 2rem;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        
        .login-form h2 {
          margin-bottom: 1.5rem;
          text-align: center;
          color: var(--primary);
        }
        
        .login-options {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        
        .login-option {
          flex: 1;
          text-align: center;
          padding: 1rem;
          cursor: pointer;
          color: var(--gray);
          font-weight: 500;
          border-bottom: 2px solid transparent;
        }
        
        .login-option.active {
          color: var(--primary);
          border-bottom: 2px solid var(--primary);
        }
        
        .login-footer {
          text-align: center;
          margin-top: 1.5rem;
          color: var(--gray);
          font-size: 0.9rem;
        }
        
        .login-footer a {
          color: var(--primary);
          text-decoration: none;
        }
        
        @media (max-width: 768px) {
          .header-container {
            flex-direction: column;
            padding: 1rem;
          }
          
          .logo {
            margin-bottom: 1rem;
          }
          
          nav ul {
            flex-wrap: wrap;
            justify-content: center;
          }
          
          nav ul li {
            margin: 0.5rem;
          }
          
          .hero {
            padding: 3rem 1rem;
          }
          
          .hero h1 {
            font-size: 2rem;
          }
          
          .btn-group {
            flex-direction: column;
            align-items: center;
          }
          
          section {
            padding: 3rem 1rem;
          }
          
          .contact-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <header>
        <div class="header-container">
          <div class="logo">Geo<span>Synth</span> QC Pro</div>
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/features">Features</a></li>
              <li><a href="/pricing">Pricing</a></li>
              <li><a href="/demo">Demo</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/login">Login</a></li>
            </ul>
          </nav>
        </div>
      </header>
      
      <section class="hero">
        <div class="hero-container">
          <h1>Professional Quality Control for Geosynthetic Projects</h1>
          <p>Advanced AI-powered tools to streamline your QC process, reduce errors, and deliver projects with confidence.</p>
          <div class="btn-group">
            <a href="/demo" class="btn btn-cta">See It In Action</a>
            <a href="/signup" class="btn btn-light">Start Free Trial</a>
          </div>
        </div>
      </section>
      
      <section class="features">
        <div class="container">
          <div class="section-title">
            <h2>Powerful Features</h2>
            <p>Our comprehensive platform provides all the tools you need to manage geosynthetic quality control from start to finish.</p>
          </div>
          
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-icon ai"></div>
              <div class="feature-content">
                <h3>AI Document Analysis</h3>
                <p>Automatically extract data from test reports, specifications, and field notes with our advanced OCR technology. Save hours of manual entry and eliminate transcription errors.</p>
                <a href="/features#ai" class="btn">Learn More</a>
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon design"></div>
              <div class="feature-content">
                <h3>2D Panel Optimization</h3>
                <p>Our intelligent panel layout tools help you design efficient installations, minimize material waste, and visualize your project before deployment. Includes CAD export functionality.</p>
                <a href="/features#design" class="btn">Learn More</a>
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon"></div>
              <div class="feature-content">
                <h3>Real-Time Collaboration</h3>
                <p>Work seamlessly with your team members and clients regardless of location. Changes update instantly with our secure websocket technology. Includes role-based access control.</p>
                <a href="/features#collaboration" class="btn">Learn More</a>
              </div>
            </div>
            
            <div class="feature-card">
              <div class="feature-icon data"></div>
              <div class="feature-content">
                <h3>QC Data Management</h3>
                <p>Track all quality control metrics in one place with customizable dashboards, automated alerts for test failures, and comprehensive reporting tools to satisfy client requirements.</p>
                <a href="/features#data" class="btn">Learn More</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section class="cta-section">
        <div class="container">
          <h2>Ready to Modernize Your QC Process?</h2>
          <p>Join industry leaders who have reduced reporting time by 60% and material waste by 35%.</p>
          <a href="/signup" class="btn btn-light">Get Started Today</a>
        </div>
      </section>
      
      <section class="pricing" id="pricing">
        <div class="container">
          <div class="section-title">
            <h2>Simple, Transparent Pricing</h2>
            <p>Choose the plan that best fits your project needs with no hidden fees or long-term commitments.</p>
          </div>
          
          <div class="pricing-grid">
            <div class="pricing-card">
              <div class="pricing-header">
                <h3>Basic</h3>
                <div class="pricing-price">$115<span>/month</span></div>
                <p>For smaller projects and teams</p>
              </div>
              <div class="pricing-features">
                <ul>
                  <li>5 Active Projects</li>
                  <li>3 Team Members</li>
                  <li>Document Analysis (Limited)</li>
                  <li>Panel Layout Tools</li>
                  <li>Basic Reporting</li>
                  <li>Email Support</li>
                </ul>
              </div>
              <div class="pricing-action">
                <a href="/signup?plan=basic" class="btn">Get Started</a>
              </div>
            </div>
            
            <div class="pricing-card highlight">
              <div class="popular-badge">Most Popular</div>
              <div class="pricing-header">
                <h3>Premium</h3>
                <div class="pricing-price">$315<span>/month</span></div>
                <p>For professional teams & complex projects</p>
              </div>
              <div class="pricing-features">
                <ul>
                  <li>Unlimited Projects</li>
                  <li>Unlimited Team Members</li>
                  <li>Advanced AI Analysis</li>
                  <li>Custom Workflows</li>
                  <li>API Integration</li>
                  <li>Priority Support</li>
                  <li>Compliance Reports</li>
                  <li>Advanced Panel Optimization</li>
                </ul>
              </div>
              <div class="pricing-action">
                <a href="/signup?plan=premium" class="btn btn-cta">Get Started</a>
              </div>
            </div>
            
            <div class="pricing-card">
              <div class="pricing-header">
                <h3>Enterprise</h3>
                <div class="pricing-price">Custom<span>/pricing</span></div>
                <p>For large organizations with specific needs</p>
              </div>
              <div class="pricing-features">
                <ul>
                  <li>All Premium Features</li>
                  <li>Dedicated Account Manager</li>
                  <li>Custom AI Training</li>
                  <li>On-site Implementation</li>
                  <li>SSO Integration</li>
                  <li>24/7 Phone Support</li>
                  <li>Custom Reporting</li>
                </ul>
              </div>
              <div class="pricing-action">
                <a href="/contact" class="btn">Contact Us</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section class="testimonials">
        <div class="container">
          <div class="section-title">
            <h2>What Our Clients Say</h2>
            <p>Join hundreds of satisfied clients who have transformed their quality control processes.</p>
          </div>
          
          <div class="testimonial-grid">
            <div class="testimonial-card">
              <div class="testimonial-text">
                "GeoSynth QC Pro has completely transformed how we manage quality control. The AI document analysis alone has saved us countless hours of manual data entry and eliminated errors."
              </div>
              <div class="testimonial-author">
                <div class="testimonial-avatar">JD</div>
                <div class="testimonial-info">
                  <h4>John Donovan</h4>
                  <p>Senior QC Manager, EcoLiner Solutions</p>
                </div>
              </div>
            </div>
            
            <div class="testimonial-card">
              <div class="testimonial-text">
                "The panel optimization tools have reduced our material waste by over 30%. The system paid for itself within the first two projects."
              </div>
              <div class="testimonial-author">
                <div class="testimonial-avatar">SM</div>
                <div class="testimonial-info">
                  <h4>Sarah Martinez</h4>
                  <p>Project Director, GeoTech Industries</p>
                </div>
              </div>
            </div>
            
            <div class="testimonial-card">
              <div class="testimonial-text">
                "As a compliance manager, the automated reporting tools have made my job significantly easier. I can generate client-ready reports with just a few clicks."
              </div>
              <div class="testimonial-author">
                <div class="testimonial-avatar">RJ</div>
                <div class="testimonial-info">
                  <h4>Robert Johnson</h4>
                  <p>Compliance Director, EnviroCell</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section class="contact" id="contact">
        <div class="container">
          <div class="section-title">
            <h2>Contact Us</h2>
            <p>Have questions? Our team is ready to help you find the perfect solution for your needs.</p>
          </div>
          
          <div class="contact-grid">
            <div class="contact-form">
              <form action="/api/contact" method="POST">
                <div class="form-group">
                  <label for="name">Name</label>
                  <input type="text" id="name" name="name" required>
                </div>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                  <label for="company">Company</label>
                  <input type="text" id="company" name="company">
                </div>
                <div class="form-group">
                  <label for="interest">I'm interested in</label>
                  <select id="interest" name="interest">
                    <option value="general">General Information</option>
                    <option value="demo">Product Demo</option>
                    <option value="quote">Custom Quote</option>
                    <option value="support">Technical Support</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="message">Message</label>
                  <textarea id="message" name="message" required></textarea>
                </div>
                <button type="submit" class="btn btn-cta" style="width: 100%;">Send Message</button>
              </form>
            </div>
            
            <div class="contact-info">
              <h3>Get In Touch</h3>
              
              <div class="contact-method">
                <h4>Email</h4>
                <p>info@geosynthqcpro.com</p>
              </div>
              
              <div class="contact-method">
                <h4>Phone</h4>
                <p>+1 (555) 123-4567</p>
              </div>
              
              <div class="contact-method">
                <h4>Office</h4>
                <p>
                  123 Geosynthetic Way<br>
                  Suite 400<br>
                  Houston, TX 77002
                </p>
              </div>
              
              <div class="contact-method">
                <h4>Hours</h4>
                <p>
                  Monday - Friday: 8am - 6pm CST<br>
                  Saturday: 9am - 1pm CST<br>
                  Sunday: Closed
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <footer>
        <p>&copy; ${new Date().getFullYear()} GeoSynth QC Pro. All rights reserved.</p>
      </footer>
    </body>
    </html>
  `);
});

// Demo route - Professional dashboard
app.get('/demo', (req, res) => {
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
              📋 Projects
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
  res.json({ success: true, message: 'Thank you for contacting us!' });
});

// Fallback route for any unhandled routes
app.use((req, res) => {
  // If no route matched, redirect to home page
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
});