'use client';
export const dynamic = "force-dynamic";

import { useState } from 'react';
import './settings.css';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  
  // General Settings State
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');
  
  // QC Settings State
  const [automaticQC, setAutomaticQC] = useState(true);
  const [qcThreshold, setQcThreshold] = useState(85);
  const [reportFrequency, setReportFrequency] = useState('weekly');
  const [alertLevel, setAlertLevel] = useState('high');
  
  // Data Settings State
  const [dataRetention, setDataRetention] = useState(90);
  const [autoBackup, setAutoBackup] = useState(true);
  const [exportFormat, setExportFormat] = useState('csv');

  const handleSave = async (section: string) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    alert(`${section} settings saved successfully!`);
    setIsLoading(false);
  };

  const handleReset = (section: string) => {
    if (confirm(`Are you sure you want to reset ${section} settings to defaults?`)) {
      if (section === 'General') {
        setEmailNotifications(true);
        setBrowserNotifications(false);
        setDarkMode(false);
        setLanguage('en');
      } else if (section === 'QC') {
        setAutomaticQC(true);
        setQcThreshold(85);
        setReportFrequency('weekly');
        setAlertLevel('high');
      } else if (section === 'Data') {
        setDataRetention(90);
        setAutoBackup(true);
        setExportFormat('csv');
      }
      alert(`${section} settings reset to defaults.`);
    }
  };

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      alert('Account deletion functionality ready! This will connect to your backend when ready.');
    }
  };

  const ToggleSwitch = ({ active, onChange }: { active: boolean; onChange: () => void }) => (
    <div 
      className={`toggle-switch ${active ? 'active' : ''}`}
      onClick={onChange}
    />
  );

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Configure your application preferences and account settings.
          </p>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          <button 
            className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button 
            className={`tab-button ${activeTab === 'qc' ? 'active' : ''}`}
            onClick={() => setActiveTab('qc')}
          >
            Quality Control
          </button>
          <button 
            className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Data Management
          </button>
          <button 
            className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            Account
          </button>
        </div>

        {/* General Settings */}
        <div className={`tab-content ${activeTab === 'general' ? 'active' : ''}`}>
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">General Preferences</h2>
              <p className="section-description">Configure general application settings and notifications</p>
            </div>
            <div className="section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Email Notifications</h3>
                  <p className="setting-description">Receive email notifications for important updates</p>
                </div>
                <div className="setting-control">
                  <ToggleSwitch 
                    active={emailNotifications} 
                    onChange={() => setEmailNotifications(!emailNotifications)} 
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Browser Notifications</h3>
                  <p className="setting-description">Show desktop notifications in your browser</p>
                </div>
                <div className="setting-control">
                  <ToggleSwitch 
                    active={browserNotifications} 
                    onChange={() => setBrowserNotifications(!browserNotifications)} 
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Dark Mode</h3>
                  <p className="setting-description">Use dark theme for the interface</p>
                </div>
                <div className="setting-control">
                  <ToggleSwitch 
                    active={darkMode} 
                    onChange={() => setDarkMode(!darkMode)} 
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Language</h3>
                  <p className="setting-description">Choose your preferred language</p>
                </div>
                <div className="setting-control">
                  <select 
                    className="select-dropdown"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
              </div>

              <div className="section-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => handleReset('General')}
                >
                  Reset to Defaults
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleSave('General')}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* QC Settings */}
        <div className={`tab-content ${activeTab === 'qc' ? 'active' : ''}`}>
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">Quality Control Settings</h2>
              <p className="section-description">Configure QC automation and reporting preferences</p>
            </div>
            <div className="section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Automatic QC Analysis</h3>
                  <p className="setting-description">Automatically analyze uploaded QC data</p>
                </div>
                <div className="setting-control">
                  <ToggleSwitch 
                    active={automaticQC} 
                    onChange={() => setAutomaticQC(!automaticQC)} 
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">QC Pass Threshold</h3>
                  <p className="setting-description">Minimum score for automatic pass rating ({qcThreshold}%)</p>
                </div>
                <div className="setting-control">
                  <div className="slider-container">
                    <input
                      type="range"
                      min="70"
                      max="99"
                      value={qcThreshold}
                      onChange={(e) => setQcThreshold(Number(e.target.value))}
                      className="slider"
                    />
                    <span className="slider-value">{qcThreshold}%</span>
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Report Frequency</h3>
                  <p className="setting-description">How often to generate automatic reports</p>
                </div>
                <div className="setting-control">
                  <select 
                    className="select-dropdown"
                    value={reportFrequency}
                    onChange={(e) => setReportFrequency(e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="manual">Manual Only</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Alert Level</h3>
                  <p className="setting-description">Minimum severity for QC alerts</p>
                </div>
                <div className="setting-control">
                  <select 
                    className="select-dropdown"
                    value={alertLevel}
                    onChange={(e) => setAlertLevel(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical Only</option>
                  </select>
                </div>
              </div>

              <div className="section-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => handleReset('QC')}
                >
                  Reset to Defaults
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleSave('QC')}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className={`tab-content ${activeTab === 'data' ? 'active' : ''}`}>
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">Data Management</h2>
              <p className="section-description">Configure data retention and backup settings</p>
            </div>
            <div className="section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Data Retention Period</h3>
                  <p className="setting-description">How long to keep project data ({dataRetention} days)</p>
                </div>
                <div className="setting-control">
                  <div className="slider-container">
                    <input
                      type="range"
                      min="30"
                      max="365"
                      step="30"
                      value={dataRetention}
                      onChange={(e) => setDataRetention(Number(e.target.value))}
                      className="slider"
                    />
                    <span className="slider-value">{dataRetention} days</span>
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Automatic Backup</h3>
                  <p className="setting-description">Automatically backup your data daily</p>
                </div>
                <div className="setting-control">
                  <ToggleSwitch 
                    active={autoBackup} 
                    onChange={() => setAutoBackup(!autoBackup)} 
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Default Export Format</h3>
                  <p className="setting-description">Preferred format for data exports</p>
                </div>
                <div className="setting-control">
                  <select 
                    className="select-dropdown"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                    <option value="pdf">PDF</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>

              <div className="section-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => handleReset('Data')}
                >
                  Reset to Defaults
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleSave('Data')}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className={`tab-content ${activeTab === 'account' ? 'active' : ''}`}>
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">Account Security</h2>
              <p className="section-description">Manage your account security and preferences</p>
            </div>
            <div className="section-content">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter current password"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter new password"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Confirm new password"
                />
              </div>

              <div className="section-actions">
                <button 
                  className="btn-primary"
                  onClick={() => handleSave('Password')}
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>

              <div className="danger-zone">
                <h3 className="danger-title">Danger Zone</h3>
                <p className="danger-description">
                  Once you delete your account, there is no going back. This will permanently delete your account and all associated data.
                </p>
                <button 
                  className="btn-danger"
                  onClick={handleDeleteAccount}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}