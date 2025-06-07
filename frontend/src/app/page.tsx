'use client';

import Link from 'next/link';
import './landing.css';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header>
        <div className="container">
          <div className="header-content">
            <div className="logo">
              GeoSynth <span className="accent">QC Pro</span>
            </div>
            
            <nav>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/dashboard/panel-layout">Demo</Link>
            </nav>
            
            <div className="auth-buttons">
              <Link href="/login" className="btn btn-secondary">Sign In</Link>
              <Link href="/signup" className="btn btn-primary">Start Free Trial</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <h1>
            Professional Quality Control for 
            <span className="highlight"> Geosynthetic Projects</span>
          </h1>
          <p>
            Streamline your QC workflows with AI-powered automation, intelligent panel optimization, 
            and comprehensive project management designed for geosynthetic engineering professionals.
          </p>
          <div className="hero-buttons">
            <Link href="/signup" className="btn btn-primary btn-large">Start Free Trial</Link>
            <Link href="/dashboard" className="btn btn-outline btn-large">Login to Dashboard</Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <div className="section-header">
            <h2>Powerful Features for Professional QC</h2>
            <p>Everything you need to manage geosynthetic projects efficiently and professionally</p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered QC Automation</h3>
              <p>Automated anomaly detection and intelligent data analysis reduce manual review time by up to 80%</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📐</div>
              <h3>Panel Layout Optimization</h3>
              <p>Advanced algorithms optimize panel placement for maximum efficiency and cost savings</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📁</div>
              <h3>Document Management</h3>
              <p>Centralized storage and AI-powered document analysis streamline project documentation</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Real-time Monitoring</h3>
              <p>Live project tracking with instant notifications for critical QC events</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">✅</div>
              <h3>Compliance Reporting</h3>
              <p>Automated generation of industry-standard compliance reports and certifications</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Team Collaboration</h3>
              <p>Multi-user access with role-based permissions for seamless team coordination</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing">
        <div className="container">
          <div className="section-header">
            <h2>Professional Pricing Plans</h2>
            <p>Choose the plan that fits your project needs and team size</p>
          </div>
          
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Basic</h3>
                <div>
                  <span className="price">$115</span>
                  <span className="period">per month</span>
                </div>
                <p className="description">Perfect for small teams and individual professionals</p>
              </div>
              
              <ul className="features-list">
                <li><span>Up to 5 active projects</span></li>
                <li><span>Basic QC automation</span></li>
                <li><span>Standard panel optimization</span></li>
                <li><span>Document storage (10GB)</span></li>
                <li><span>Email support</span></li>
                <li><span>Basic reporting</span></li>
              </ul>
              
              <Link href="/signup" className="btn btn-outline" style={{width: '100%', textAlign: 'center', display: 'block'}}>
                Start Basic Plan
              </Link>
            </div>
            
            <div className="pricing-card popular">
              <div className="popular-badge">Most Popular</div>
              <div className="pricing-header">
                <h3>Premium</h3>
                <div>
                  <span className="price">$315</span>
                  <span className="period">per month</span>
                </div>
                <p className="description">Advanced features for professional teams and enterprises</p>
              </div>
              
              <ul className="features-list">
                <li><span>Unlimited projects</span></li>
                <li><span>Advanced AI automation</span></li>
                <li><span>Premium panel optimization</span></li>
                <li><span>Unlimited document storage</span></li>
                <li><span>Priority phone & email support</span></li>
                <li><span>Advanced analytics & reporting</span></li>
                <li><span>Custom integrations</span></li>
                <li><span>Team collaboration tools</span></li>
              </ul>
              
              <Link href="/signup" className="btn btn-primary" style={{width: '100%', textAlign: 'center', display: 'block'}}>
                Start Premium Plan
              </Link>
            </div>
          </div>
          
          <div style={{textAlign: 'center', marginTop: '3rem'}}>
            <p style={{color: 'var(--gray-600)', marginBottom: '1rem'}}>All plans include 30-day free trial • No setup fees • Cancel anytime</p>
            <Link href="/dashboard" style={{color: 'var(--navy-600)', fontWeight: '600', textDecoration: 'none'}}>
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container">
          <p>© 2025 GeoSynth QC Pro. Professional Quality Control for Geosynthetic Projects.</p>
        </div>
      </footer>
    </div>
  );
}