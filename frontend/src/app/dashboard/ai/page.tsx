'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../hooks/use-auth';
import './ai.css';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  references?: Array<{
    docId: string;
    page: number;
    excerpt: string;
  }>;
}

interface Document {
  id: string;
  filename: string;
  uploadDate: string;
  text?: string;
}

interface JobStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  created_at?: string;
  completed_at?: string;
}

interface HandwritingScanResult {
  filename: string;
  excelUrl: string;
  qcData: any;
  validation: {
    isValid: boolean;
    issues: string[];
    confidence: number;
  };
  extractedText: any;
  processingInfo: {
    originalFilename: string;
    fileSize: number;
    mimeType: string;
    processedAt: string;
  };
}

interface Project {
  id: string;
  name: string;
  description?: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AIAssistantPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatus>({ status: 'idle' });
  const [isGeneratingLayout, setIsGeneratingLayout] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isProcessingHandwriting, setIsProcessingHandwriting] = useState(false);
  const [handwritingResult, setHandwritingResult] = useState<HandwritingScanResult | null>(null);
  const [showHandwritingPreview, setShowHandwritingPreview] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handwritingInputRef = useRef<HTMLInputElement>(null);

  // Fetch available projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!isAuthenticated) return;
      
      try {
        const response = await fetch('/api/projects', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };

    fetchProjects();
  }, [isAuthenticated]);

  // Get project ID from URL params
  useEffect(() => {
    const projectId = searchParams?.get('projectId');
    if (projectId) {
      setSelectedProject(projectId);
    }
  }, [searchParams]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll job status when generating layout
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedProject && jobStatus.status === 'processing') {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/ai/job-status/${selectedProject}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const status = await response.json();
            setJobStatus(status);
            if (status.status !== 'processing') {
              setIsGeneratingLayout(false);
            }
          }
        } catch (error) {
          console.error('Error polling job status:', error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [selectedProject, jobStatus.status]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setIsUploadingDoc(true);
    const newDocuments: Document[] = [];

    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // In a real implementation, you'd process the file content
        // For now, we'll simulate document text extraction
        const docText = `Extracted content from ${file.name}. This is sample content for demonstration.`;
        
        const newDoc: Document = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          filename: file.name,
          uploadDate: new Date().toISOString(),
          text: docText
        };
        newDocuments.push(newDoc);
      }
    }

    setDocuments(prev => [...prev, ...newDocuments]);
    setIsUploadingDoc(false);
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedProject) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          projectId: selectedProject,
          question: inputValue,
          documents: documents.map(doc => ({
            id: doc.id,
            filename: doc.filename,
            text: doc.text
          }))
        })
      });

      if (response.ok) {
        const aiResponse = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: aiResponse.answer,
          timestamp: new Date(),
          references: aiResponse.references
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleHandwritingUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !selectedProject) return;

    const file = files[0];
    setIsProcessingHandwriting(true);
    setHandwritingResult(null);

    try {
      const formData = new FormData();
      formData.append('qcForm', file);
      formData.append('projectId', selectedProject);

      const response = await fetch('/api/handwriting/scan', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setHandwritingResult(result.data);
        setShowHandwritingPreview(true);
        
        // Add a message about the successful scan
        const aiMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: `Successfully processed handwritten QC form "${file.name}". 
          ${result.data.validation.isValid ? 
            `Extracted ${Object.keys(result.data.qcData.panels || {}).length} panels and ${Object.keys(result.data.qcData.tests || {}).length} tests with ${(result.data.validation.confidence * 100).toFixed(1)}% confidence.` :
            `Found ${result.data.validation.issues.length} validation issues that may need review.`
          } Excel report is ready for download.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        
      } else {
        throw new Error('Failed to process handwriting scan');
      }
    } catch (error) {
      console.error('Error processing handwriting:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error processing the handwritten form. Please ensure the image is clear and try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessingHandwriting(false);
      if (handwritingInputRef.current) {
        handwritingInputRef.current.value = '';
      }
    }
  };

  const handleDownloadExcel = () => {
    if (!handwritingResult) return;
    
    // Create a download link
    const link = document.createElement('a');
    link.href = handwritingResult.excelUrl;
    link.download = handwritingResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateLayout = async () => {
    if (!selectedProject || documents.length === 0) return;

    setIsGeneratingLayout(true);
    setJobStatus({ status: 'processing' });

    try {
      const response = await fetch('/api/ai/automate-layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          projectId: selectedProject,
          documents: documents.map(doc => ({
            id: doc.id,
            filename: doc.filename,
            text: doc.text
          }))
        })
      });

      if (response.ok) {
        const layoutData = await response.json();
        setJobStatus({ status: 'completed' });
        
        // Navigate to the panel layout page with the generated layout
        router.push(`/dashboard/projects/${selectedProject}/panel-layout?generated=true`);
      } else {
        throw new Error('Failed to generate layout');
      }
    } catch (error) {
      console.error('Error generating layout:', error);
      setIsGeneratingLayout(false);
      setJobStatus({ status: 'failed' });
    }
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const projectData = {
      name: formData.get('name') as string,
      client: formData.get('client') as string,
      location: formData.get('location') as string,
      startDate: formData.get('startDate') as string,
      description: formData.get('description') as string,
    };

    setIsCreatingProject(true);
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        const newProject = await response.json();
        setProjects(prev => [newProject, ...prev]);
        setSelectedProject(newProject.id);
        setShowCreateProject(false);
        
        // Reset form
        event.currentTarget.reset();
      } else {
        throw new Error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="ai-page">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to access the AI Assistant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-page">
      <div className="ai-header">
        <h1>AI Assistant</h1>
        <p>Upload documents, ask questions, and generate optimized panel layouts</p>
      </div>

      {/* Project Selection Section */}
      <div className="project-selection-section">
        <div className="section-header">
          <h2>Project Selection</h2>
          {selectedProject && (
            <span className="selected-project-info">
              Working on: {projects.find(p => p.id === selectedProject)?.name || selectedProject}
            </span>
          )}
        </div>
        
        <div className="project-selector">
          {projects.length === 0 ? (
            <div className="no-projects">
              <p>No projects found. Create a project first to use AI features.</p>
              <div className="project-actions">
                <button 
                  onClick={() => setShowCreateProject(true)}
                  className="btn-create-project"
                >
                  Create Project
                </button>
                <button 
                  onClick={() => router.push('/dashboard/projects')}
                  className="btn-secondary"
                >
                  Go to Projects
                </button>
              </div>
            </div>
          ) : (
            <div className="project-dropdown">
              <label className="dropdown-label">Select a project to enable AI features:</label>
              <select 
                value={selectedProject || ''} 
                onChange={(e) => setSelectedProject(e.target.value || null)}
                className="project-select"
              >
                <option value="">Choose a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name} - {project.location || 'No location'}
                  </option>
                ))}
              </select>
              <button 
                onClick={() => setShowCreateProject(true)}
                className="btn-new-project"
              >
                Create New Project
              </button>
            </div>
          )}
        </div>

        {/* Create Project Modal */}
        {showCreateProject && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Create New Project</h3>
                <button 
                  onClick={() => setShowCreateProject(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleCreateProject} className="create-project-form">
                <div className="form-group">
                  <label htmlFor="name">Project Name *</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    required 
                    placeholder="Enter project name"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="client">Client *</label>
                  <input 
                    type="text" 
                    id="client" 
                    name="client" 
                    required 
                    placeholder="Enter client name"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="location">Location</label>
                  <input 
                    type="text" 
                    id="location" 
                    name="location" 
                    placeholder="Enter project location"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="startDate">Start Date *</label>
                  <input 
                    type="date" 
                    id="startDate" 
                    name="startDate" 
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea 
                    id="description" 
                    name="description" 
                    rows={3}
                    placeholder="Optional project description"
                  />
                </div>
                
                <div className="form-actions">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateProject(false)}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isCreatingProject}
                    className="btn-create-project"
                  >
                    {isCreatingProject ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="ai-content">
        {/* Document Upload Section */}
        <div className="document-section">
          <div className="section-header">
            <h2>Documents</h2>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="btn-upload"
              disabled={isUploadingDoc}
            >
              {isUploadingDoc ? 'Uploading...' : 'Upload Documents'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
          
          <div className="document-list">
            {documents.length === 0 ? (
              <p className="empty-state">No documents uploaded yet. Upload PDFs or Word documents to get started.</p>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="document-item">
                  <div className="doc-info">
                    <span className="doc-name">{doc.filename}</span>
                    <span className="doc-date">
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </span>
                  </div>
                  <button className="btn-read-ai">Read with AI</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="chat-section">
          <div className="chat-header">
            <h2>Ask Questions</h2>
            {selectedProject ? (
              <span className="project-indicator">Project: {selectedProject.substring(0, 8)}...</span>
            ) : (
              <span className="project-warning">No project selected</span>
            )}
          </div>
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <p>Start a conversation with the AI assistant. Ask questions about your documents or project requirements.</p>
              </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className={`message ${message.type}`}>
                  <div className="message-content">
                    <p>{message.content}</p>
                    {message.references && message.references.length > 0 && (
                      <div className="references">
                        <h4>Sources:</h4>
                        {message.references.map((ref, index) => (
                          <div key={index} className="reference-item">
                            <span className="ref-source">
                              Document: {documents.find(d => d.id === ref.docId)?.filename || 'Unknown'} (Page {ref.page})
                            </span>
                            <p className="ref-excerpt">"{ref.excerpt}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={selectedProject ? "Ask a question about your documents..." : "Select a project first"}
              disabled={!selectedProject}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !selectedProject}
              className="btn-send"
            >
              Send
            </button>
          </div>
        </div>

        {/* Handwriting OCR Section */}
        <div className="handwriting-section">
          <div className="section-header">
            <h2>QC Form Scanner</h2>
            <button 
              onClick={() => handwritingInputRef.current?.click()}
              className="btn-upload"
              disabled={isProcessingHandwriting || !selectedProject}
            >
              {isProcessingHandwriting ? 'Processing...' : 'Scan Handwritten Form'}
            </button>
            <input
              ref={handwritingInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleHandwritingUpload}
              style={{ display: 'none' }}
            />
          </div>
          
          <div className="handwriting-info">
            <p>Upload scanned images or PDFs of handwritten QC forms to automatically extract data and generate Excel reports.</p>
            <div className="supported-formats">
              <span>Supported: JPG, PNG, PDF</span>
              <span>Best results: Clear, high-contrast scans</span>
            </div>
          </div>

          {/* Processing Status */}
          {isProcessingHandwriting && (
            <div className="processing-status">
              <div className="loading-spinner"></div>
              <span>Processing handwritten form with AI...</span>
            </div>
          )}

          {/* Results Preview */}
          {handwritingResult && (
            <div className="handwriting-results">
              <div className="results-header">
                <h3>Scan Results</h3>
                <div className="confidence-indicator">
                  <span className={`confidence ${handwritingResult.validation.confidence > 0.8 ? 'high' : handwritingResult.validation.confidence > 0.6 ? 'medium' : 'low'}`}>
                    {(handwritingResult.validation.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
              </div>

              <div className="results-summary">
                <div className="summary-stats">
                  <div className="stat">
                    <span className="label">Panels:</span>
                    <span className="value">{handwritingResult.qcData.panels?.length || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Tests:</span>
                    <span className="value">{handwritingResult.qcData.tests?.length || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Status:</span>
                    <span className={`value ${handwritingResult.validation.isValid ? 'valid' : 'invalid'}`}>
                      {handwritingResult.validation.isValid ? 'Valid' : `${handwritingResult.validation.issues.length} issues`}
                    </span>
                  </div>
                </div>

                {/* Validation Issues */}
                {!handwritingResult.validation.isValid && (
                  <div className="validation-issues">
                    <h4>Validation Issues:</h4>
                    <ul>
                      {handwritingResult.validation.issues.map((issue, index) => (
                        <li key={index} className="issue-item">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="results-actions">
                  <button 
                    onClick={handleDownloadExcel}
                    className="btn-download"
                  >
                    Download Excel Report
                  </button>
                  <button 
                    onClick={() => setShowHandwritingPreview(!showHandwritingPreview)}
                    className="btn-preview"
                  >
                    {showHandwritingPreview ? 'Hide' : 'Show'} Preview
                  </button>
                </div>

                {/* Data Preview */}
                {showHandwritingPreview && (
                  <div className="data-preview">
                    <div className="preview-tabs">
                      <div className="tab-content">
                        <h4>Project Information</h4>
                        <div className="preview-data">
                          <p><strong>Name:</strong> {handwritingResult.qcData.projectInfo?.name || 'N/A'}</p>
                          <p><strong>Location:</strong> {handwritingResult.qcData.projectInfo?.location || 'N/A'}</p>
                          <p><strong>Date:</strong> {handwritingResult.qcData.projectInfo?.date || 'N/A'}</p>
                          <p><strong>Inspector:</strong> {handwritingResult.qcData.projectInfo?.inspector || 'N/A'}</p>
                        </div>

                        {handwritingResult.qcData.panels && handwritingResult.qcData.panels.length > 0 && (
                          <>
                            <h4>Panels ({handwritingResult.qcData.panels.length})</h4>
                            <div className="preview-table">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Panel ID</th>
                                    <th>Width</th>
                                    <th>Height</th>
                                    <th>Patches</th>
                                    <th>Welder</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {handwritingResult.qcData.panels.slice(0, 5).map((panel: any, index: number) => (
                                    <tr key={index}>
                                      <td>{panel.panelId || 'N/A'}</td>
                                      <td>{panel.width || 'N/A'}</td>
                                      <td>{panel.height || 'N/A'}</td>
                                      <td>{panel.patches || 0}</td>
                                      <td>{panel.seamWelder || 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {handwritingResult.qcData.panels.length > 5 && (
                                <p className="more-data">... and {handwritingResult.qcData.panels.length - 5} more panels</p>
                              )}
                            </div>
                          </>
                        )}

                        {handwritingResult.qcData.tests && handwritingResult.qcData.tests.length > 0 && (
                          <>
                            <h4>Tests ({handwritingResult.qcData.tests.length})</h4>
                            <div className="preview-table">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Test ID</th>
                                    <th>Type</th>
                                    <th>Value</th>
                                    <th>Result</th>
                                    <th>Operator</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {handwritingResult.qcData.tests.slice(0, 5).map((test: any, index: number) => (
                                    <tr key={index}>
                                      <td>{test.testId || 'N/A'}</td>
                                      <td>{test.type || 'N/A'}</td>
                                      <td>{test.value} {test.unit}</td>
                                      <td className={`result ${test.result?.toLowerCase()}`}>{test.result || 'N/A'}</td>
                                      <td>{test.operator || 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {handwritingResult.qcData.tests.length > 5 && (
                                <p className="more-data">... and {handwritingResult.qcData.tests.length - 5} more tests</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedProject && (
            <p className="requirement-note">Select a project to enable handwriting scanning</p>
          )}
        </div>

        {/* Auto-Layout Section */}
        <div className="layout-section">
          <div className="section-header">
            <h2>AI Panel Layout Generation</h2>
            <div className="layout-status">
              {jobStatus.status === 'processing' && (
                <span className="status processing">Generating layout...</span>
              )}
              {jobStatus.status === 'completed' && (
                <span className="status completed">Layout generated successfully</span>
              )}
              {jobStatus.status === 'failed' && (
                <span className="status failed">Layout generation failed</span>
              )}
            </div>
          </div>
          
          <div className="layout-controls">
            <button
              onClick={handleGenerateLayout}
              disabled={!selectedProject || documents.length === 0 || isGeneratingLayout}
              className="btn-generate-layout"
            >
              {isGeneratingLayout ? 'Generating Layout...' : 'Generate Layout from Docs'}
            </button>
            
            {!selectedProject && (
              <p className="requirement-note">Select a project to enable layout generation</p>
            )}
            {selectedProject && documents.length === 0 && (
              <p className="requirement-note">Upload documents to enable layout generation</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}