'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { makeAuthenticatedRequest } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';
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
  const [projectId, setProjectId] = useState<string>('69fc302b-166d-4543-9990-89c4b1e0ed59'); // Default project ID
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddTestModal, setShowAddTestModal] = useState(false);

  // Fetch projects for dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await makeAuthenticatedRequest('/api/projects');
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchQCData = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        setError(null);
        const response = await makeAuthenticatedRequest(`/api/qc-data/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setQcData(data);
        } else {
          const errorText = await response.text();
          console.error('Failed to fetch QC data:', response.status, errorText);
          setError(`Failed to fetch QC data: ${response.status} ${response.statusText}`);
          setQcData([]);
        }
      } catch (error) {
        console.error('Error fetching QC data:', error);
        setError('Error fetching QC data. Please check your connection and try again.');
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

  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;

  const handleViewTest = (testId: string) => {
    alert(`Viewing details for test ${testId}`);
  };

  const handleEditTest = (testId: string) => {
    alert(`Editing test ${testId} - Feature coming soon!`);
  };

  const handleAddTest = async (testData: Partial<QCData>) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/qc-data/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: testData.testType,
          panelId: testData.location || 'default',
          date: testData.testDate,
          result: testData.result,
          technician: testData.operator,
          notes: testData.notes,
          temperature: testData.value,
        }),
      });

      if (response.ok) {
        alert('Test added successfully!');
        // Refresh data
        window.location.reload();
      } else {
        const error = await response.text();
        alert(`Failed to add test: ${error}`);
      }
    } catch (error) {
      console.error('Add test error:', error);
      alert(`Failed to add test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExport = async (format: 'csv' | 'excel' = 'csv') => {
    if (!projectId) {
      alert('Please select a project first.');
      return;
    }

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (selectedTestType !== 'All') {
        params.append('testType', selectedTestType);
      }

      const response = await makeAuthenticatedRequest(
        `/api/qc-data/${projectId}/export/${format}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `qc-data-${projectId}-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpload = async () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await makeAuthenticatedRequest(`/api/qc-data/${projectId}/import`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          alert(`Successfully imported ${result.importedCount} QC records!`);
          // Refresh data
          window.location.reload();
        } else {
          const error = await response.text();
          alert(`Import failed: ${error}`);
        }
      } catch (error) {
        console.error('Import error:', error);
        alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    input.click();
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
          <div>
            <h1 className="qc-data-title">Quality Control Data</h1>
            <p className="qc-data-subtitle">
              View, analyze, and manage all quality control test results for your geosynthetic projects.
            </p>
          </div>
          <div className="header-actions">
            <Button onClick={handleUpload} variant="outline" className="mr-2">
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </Button>
            <Button onClick={() => setShowAddTestModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Test
            </Button>
          </div>
        </div>

        {/* Project Selection */}
        <div className="project-selection" style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <Label htmlFor="project-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Select Project
          </Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger style={{ width: '300px' }}>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fee2e2', 
            border: '1px solid #fca5a5', 
            borderRadius: '8px', 
            color: '#dc2626',
            marginBottom: '2rem'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* No Data Message */}
        {!isLoading && !error && qcData.length === 0 && (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            marginBottom: '2rem'
          }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#6b7280' }}>No QC Data Found</h3>
            <p style={{ color: '#9ca3af' }}>
              No quality control data found for the selected project. Try selecting a different project or upload some data.
            </p>
          </div>
        )}

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
              
              <div className="export-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleExport('csv')} className="btn-export">
                  Export CSV
                </button>
                <button onClick={() => handleExport('excel')} className="btn-export" style={{ backgroundColor: '#10b981', color: 'white' }}>
                  Export Excel
                </button>
              </div>
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

        {/* Add Test Modal */}
        {showAddTestModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              width: '500px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>Add New QC Test</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const testData = {
                  testType: formData.get('testType') as string,
                  testDate: formData.get('testDate') as string,
                  location: formData.get('location') as string,
                  result: formData.get('result') as 'Pass' | 'Warning' | 'Fail',
                  value: formData.get('value') as string,
                  operator: formData.get('operator') as string,
                  notes: formData.get('notes') as string,
                };
                handleAddTest(testData);
                setShowAddTestModal(false);
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <Label htmlFor="testType">Test Type</Label>
                  <Select name="testType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select test type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Seam Strength">Seam Strength</SelectItem>
                      <SelectItem value="Puncture Resistance">Puncture Resistance</SelectItem>
                      <SelectItem value="Tensile Strength">Tensile Strength</SelectItem>
                      <SelectItem value="Density">Density</SelectItem>
                      <SelectItem value="Thickness">Thickness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Label htmlFor="testDate">Test Date</Label>
                  <input
                    type="date"
                    name="testDate"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Label htmlFor="location">Location</Label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g., Panel 40, East Section"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Label htmlFor="result">Result</Label>
                  <Select name="result" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pass">Pass</SelectItem>
                      <SelectItem value="Warning">Warning</SelectItem>
                      <SelectItem value="Fail">Fail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Label htmlFor="value">Value</Label>
                  <input
                    type="text"
                    name="value"
                    placeholder="e.g., 150 N/cm"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Label htmlFor="operator">Operator</Label>
                  <input
                    type="text"
                    name="operator"
                    placeholder="Technician name"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    name="notes"
                    placeholder="Additional notes..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      resize: 'vertical'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddTestModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    Add Test
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}