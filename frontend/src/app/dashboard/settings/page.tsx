'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import './settings.css';
import { getCurrentSession } from '@/lib/supabase';
import config from '@/lib/config';

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
  
  // Automation Settings State
  const [autoCreateFromForms, setAutoCreateFromForms] = useState(false);
  const [automationTriggerTiming, setAutomationTriggerTiming] = useState<'upload' | 'approval'>('approval');
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Helper function to make authenticated fetch requests
  const makeAuthenticatedFetch = async (url: string, options: RequestInit = {}) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:34',message:'makeAuthenticatedFetch entry',data:{url,method:options.method||'GET'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    let session;
    try {
      session = await getCurrentSession();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:40',message:'getCurrentSession result',data:{hasSession:!!session,hasAccessToken:!!session?.access_token,tokenLength:session?.access_token?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:45',message:'getCurrentSession error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      throw error;
    }
    
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:52',message:'Auth header added',data:{hasAuthHeader:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:56',message:'No auth header - session missing token',data:{hasSession:!!session},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    }
    
    // Resolve relative URLs to backend URL
    const backendUrl = config.backend.baseUrl || 'http://localhost:8003';
    const fullUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:63',message:'Fetch URL resolution',data:{originalUrl:url,fullUrl,backendUrl,isRelative:!url.startsWith('http')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:71',message:'Fetch response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,url:response.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    return response;
  };

  // Load automation settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:77',message:'loadSettings entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      try {
        const response = await makeAuthenticatedFetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:82',message:'Settings loaded successfully',data:{success:data.success,hasSettings:!!data.settings,autoCreateFromForms:data.settings?.autoCreateFromForms},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          if (data.success && data.settings) {
            setAutoCreateFromForms(data.settings.autoCreateFromForms || false);
            setAutomationTriggerTiming(data.settings.automationTriggerTiming || 'approval');
          }
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:88',message:'Settings load failed',data:{status:response.status,statusText:response.statusText,url:response.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.error('Failed to load settings:', response.status, response.statusText);
        }
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/84023283-6bf6-4478-bbf7-27311cfc4893',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'settings/page.tsx:93',message:'Settings load exception',data:{error:error instanceof Error?error.message:String(error),errorType:error?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        console.error('Error loading automation settings:', error);
      }
    };
    loadSettings();
  }, []);

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
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Enabled' : 'Disabled'}
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        backgroundColor: active ? '#0052cc' : '#d1d5db',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
        flexShrink: 0
      }}
    >
      <span 
        style={{
          position: 'absolute',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'white',
          top: '2px',
          left: active ? '22px' : '2px',
          transition: 'left 0.3s',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}
      />
    </div>
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
            className={`tab-button ${activeTab === 'automation' ? 'active' : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            Automation
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

        {/* Automation Settings */}
        <div className={`tab-content ${activeTab === 'automation' ? 'active' : ''}`}>
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">Automation</h2>
              <p className="section-description">Configure automated workflows and form processing</p>
            </div>
            <div className="section-content">
              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Auto-create Items from Approved Forms</h3>
                  <p className="setting-description">
                    When enabled, approved forms from the{' '}
                    <a href="/dashboard/forms" className="text-blue-600 hover:underline">
                      Mobile Forms Review page
                    </a>{' '}
                    will automatically create panels, patches, or destructive tests in the panel layout.
                    Only forms that create visual items (panel_placement, repairs, destructive) will trigger automation.
                  </p>
                </div>
                <div className="setting-control">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span 
                      style={{ 
                        fontSize: '0.875rem', 
                        color: autoCreateFromForms ? '#0052cc' : '#6b7280',
                        fontWeight: 500,
                        minWidth: '60px'
                      }}
                    >
                      {autoCreateFromForms ? 'Enabled' : 'Disabled'}
                    </span>
                    <ToggleSwitch 
                      active={autoCreateFromForms} 
                      onChange={async () => {
                        const newValue = !autoCreateFromForms;
                        setAutoCreateFromForms(newValue);
                        setIsLoadingSettings(true);
                        try {
                          const response = await makeAuthenticatedFetch('/api/settings', {
                            method: 'PUT',
                            body: JSON.stringify({ autoCreateFromForms: newValue })
                          });
                          if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.error || `Failed to update settings: ${response.status} ${response.statusText}`);
                          }
                          const result = await response.json();
                          if (result.success) {
                            alert('Automation settings saved successfully!');
                          } else {
                            throw new Error(result.error || 'Failed to update settings');
                          }
                        } catch (error) {
                          console.error('Error updating automation settings:', error);
                          setAutoCreateFromForms(!newValue); // Revert on error
                          alert(`Failed to save automation settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        } finally {
                          setIsLoadingSettings(false);
                        }
                      }} 
                    />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h3 className="setting-label">Automation Trigger Timing</h3>
                  <p className="setting-description">
                    Choose when automation should trigger:
                    <br />
                    <strong>On Upload:</strong> Forms are automatically approved and automation triggers immediately when uploaded from mobile app.
                    <br />
                    <strong>On Approval:</strong> Forms require manual approval before automation triggers. Use this if you want to review forms before they&apos;re processed.
                  </p>
                </div>
                <div className="setting-control">
                  <select
                    value={automationTriggerTiming}
                    onChange={async (e) => {
                      const newValue = e.target.value as 'upload' | 'approval';
                      setAutomationTriggerTiming(newValue);
                      setIsLoadingSettings(true);
                      try {
                        const response = await makeAuthenticatedFetch('/api/settings', {
                          method: 'PUT',
                          body: JSON.stringify({ automationTriggerTiming: newValue })
                        });
                        if (!response.ok) {
                          const errorData = await response.json().catch(() => ({}));
                          throw new Error(errorData.error || `Failed to update settings: ${response.status} ${response.statusText}`);
                        }
                        const result = await response.json();
                        if (result.success) {
                          alert('Automation trigger timing updated successfully!');
                        } else {
                          throw new Error(result.error || 'Failed to update settings');
                        }
                      } catch (error) {
                        console.error('Error updating automation trigger timing:', error);
                        setAutomationTriggerTiming(automationTriggerTiming); // Revert on error
                        alert(`Failed to save automation trigger timing: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      } finally {
                        setIsLoadingSettings(false);
                      }
                    }}
                    className="form-select"
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minWidth: '300px' }}
                    disabled={isLoadingSettings}
                  >
                    <option value="approval">On Approval (Manual Review Required)</option>
                    <option value="upload">On Upload (Auto-approve and Trigger)</option>
                  </select>
                </div>
              </div>

              <div className="section-actions">
                <button 
                  className="btn-primary"
                  onClick={async () => {
                    setIsLoadingSettings(true);
                    try {
                      const response = await makeAuthenticatedFetch('/api/settings', {
                        method: 'PUT',
                        body: JSON.stringify({ autoCreateFromForms })
                      });
                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Failed to update settings: ${response.status} ${response.statusText}`);
                      }
                      const result = await response.json();
                      if (result.success) {
                        alert('Automation settings saved successfully!');
                      } else {
                        throw new Error(result.error || 'Failed to update settings');
                      }
                    } catch (error) {
                      console.error('Error saving automation settings:', error);
                      alert(`Failed to save automation settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setIsLoadingSettings(false);
                    }
                  }}
                  disabled={isLoadingSettings}
                >
                  {isLoadingSettings ? 'Saving...' : 'Save Changes'}
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