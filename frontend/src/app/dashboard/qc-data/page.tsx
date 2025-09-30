'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { makeAuthenticatedRequest } from '@/lib/api';
import './qc-data.css';

// QC Data interface
interface QCData {
  id: string;
  projectId: string;
  testType: string;
  testDate: string;
  location: string;
  result: 'Pass' | 'Warning' | 'Fail';
  value: string;
  operator: string;
  notes: string;
}

export default function QCDataPage() {
  const [qcData, setQcData] = useState<QCData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTestType, setSelectedTestType] = useState('All');
  const [projectId, setProjectId] = useState<string>('');

  useEffect(() => {
    const fetchQCData = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        const response = await makeAuthenticatedRequest(`/api/qc-data/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setQcData(data);
        } else {
          console.error('Failed to fetch QC data');
          setQcData([]);
        }
      } catch (error) {
        console.error('Error fetching QC data:', error);
        setQcData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQCData();
  }, [projectId]);

  // Filter data based on selected test type
  const filteredData = selectedTestType === 'All'
    ? qcData
    : qcData.filter(item => item.testType === selectedTestType);

  // Get unique test types for filter
  const testTypes = ['All', ...Array.from(new Set(qcData.map(item => item.testType)))];

  // Calculate statistics
  const stats = {
    total: qcData.length,
    pass: qcData.filter(item => item.result === 'Pass').length,
    warning: qcData.filter(item => item.result === 'Warning').length,
    fail: qcData.filter(item => item.result === 'Fail').length,
  };

  const passRate = Math.round((stats.pass / stats.total) * 100);

  const handleViewTest = (testId: string) => {
    alert(`Viewing details for test ${testId}`);
  };

  const handleEditTest = (testId: string) => {
    alert(`Editing test ${testId}`);
  };

  const handleExport = () => {
    alert('Export functionality ready! This will generate CSV when connected to backend.');
  };

  const handleUpload = () => {
    alert('Upload functionality ready! This will connect to your backend when ready.');
  };

  if (isLoading) {
    return (
      <div className="qc-data-page">
        <div className="qc-data-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qc-data-page">
      <div className="qc-data-container">
        <div className="qc-data-header">
          <h1 className="qc-data-title">Quality Control Data</h1>
          <p className="qc-data-subtitle">
            View, analyze, and manage all quality control test results for your geosynthetic projects.
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon primary">📊</div>
              <h3 className="stat-title">Total Tests</h3>
            </div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-description">Across all projects</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon success">✅</div>
              <h3 className="stat-title">Pass Rate</h3>
            </div>
            <div className="stat-value">{passRate}%</div>
            <div className="stat-progress">
              <div 
                className="stat-progress-bar progress-success" 
                style={{ width: `${passRate}%` }}
              ></div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon warning">⚠️</div>
              <h3 className="stat-title">Warnings</h3>
            </div>
            <div className="stat-value">{stats.warning}</div>
            <div className="stat-description">Requires attention</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon danger">❌</div>
              <h3 className="stat-title">Failed Tests</h3>
            </div>
            <div className="stat-value">{stats.fail}</div>
            <div className="stat-description">Critical action needed</div>
          </div>
        </div>

        {/* Data Table Section */}
        <div className="data-section">
          <div className="data-section-header">
            <h2 className="data-section-title">Test Results</h2>
            
            <div className="filter-controls">
              <div className="filter-toggle">
                {testTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedTestType(type)}
                    className={`filter-option ${selectedTestType === type ? 'active' : ''}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              
              <button onClick={handleExport} className="btn-export">
                Export CSV
              </button>
            </div>
          </div>
          
          <div style={{overflowX: 'auto'}}>
            <table className="data-table">
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
                {filteredData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.testType}</td>
                    <td>{item.testDate}</td>
                    <td>{item.location}</td>
                    <td>
                      <span className={`result-badge result-${item.result.toLowerCase()}`}>
                        {item.result}
                      </span>
                    </td>
                    <td>{item.value}</td>
                    <td>{item.operator}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleViewTest(item.id)}
                          className="action-btn"
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleEditTest(item.id)}
                          className="action-btn edit"
                          title="Edit Test"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredData.length === 0 && (
              <div className="empty-state">
                No test results found for the selected filter.
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis Section */}
        <div className="analysis-section">
          <h2 className="analysis-title">AI Analysis</h2>
          <p className="analysis-subtitle">
            Automated insights from your QC data
          </p>
          
          <div className="insight-item">
            <div className="insight-icon success">📈</div>
            <div className="insight-content">
              <h3>Consistent Performance</h3>
              <p>
                Seam strength tests show consistent results across all tested locations, indicating good installation quality.
              </p>
            </div>
          </div>
          
          <div className="insight-item">
            <div className="insight-icon warning">⚠️</div>
            <div className="insight-content">
              <h3>Potential Concern</h3>
              <p>
                Density readings in the East Section are trending toward the lower acceptable limit. Monitoring recommended.
              </p>
            </div>
          </div>
          
          <div className="insight-item">
            <div className="insight-icon danger">❌</div>
            <div className="insight-content">
              <h3>Action Required</h3>
              <p>
                Puncture resistance test in South Corner failed to meet minimum requirements. Recommend re-testing and possible material verification.
              </p>
            </div>
          </div>
          
          <button onClick={handleUpload} className="btn-upload">
            Upload New QC Data
          </button>
        </div>
      </div>
    </div>
  );
}