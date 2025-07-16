'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useProjects } from '@/contexts/ProjectsProvider';
import ProjectSelector from '@/components/projects/project-selector';
import NoProjectSelected from '@/components/ui/no-project-selected';
import { scanHandwriting, automateLayout } from '@/lib/api';
import { getCurrentSession } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
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

export default function AIAssistantPage() {
  const { user, isAuthenticated, loading } = useSupabaseAuth();
  const { selectedProjectId, selectedProject, selectProject, projects } = useProjects();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatus>({ status: 'idle' });
  const [isGeneratingLayout, setIsGeneratingLayout] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isProcessingHandwriting, setIsProcessingHandwriting] = useState(false);
  const [handwritingResult, setHandwritingResult] = useState<HandwritingScanResult | null>(null);
  const [showHandwritingPreview, setShowHandwritingPreview] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handwritingInputRef = useRef<HTMLInputElement>(null);

  // All hooks must be called before any conditional logic
  // Get project ID from URL params and sync with context
  useEffect(() => {
    const projectId = searchParams?.get('projectId');
    console.log('URL params useEffect - projectId from URL:', projectId);
    console.log('Current selectedProjectId:', selectedProjectId);
    
    if (projectId && projectId !== selectedProjectId) {
      console.log('Calling selectProject with projectId:', projectId);
      selectProject(projectId);
    }
  }, [searchParams, selectedProjectId, selectProject]);

  // Fetch documents for the selected project from backend
  const fetchDocuments = async () => {
    console.log('fetchDocuments called with selectedProject:', selectedProject);
    console.log('selectedProject type:', typeof selectedProject);
    console.log('selectedProject.id:', selectedProject?.id);
    
    if (!selectedProject || !selectedProject.id) {
      console.log('fetchDocuments: No selectedProject or selectedProject.id, skipping fetch');
      return;
    }
    
    // Check if selectedProject is just a string (ID) instead of an object
    if (typeof selectedProject === 'string') {
      console.log('fetchDocuments: selectedProject is a string, not an object. ID:', selectedProject);
      return;
    }
    
    try {
      console.log('fetchDocuments: Fetching documents for project:', selectedProject.id);
      const response = await fetch(`/api/connected-workflow/documents/${selectedProject.id}`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // On project change, fetch documents
  useEffect(() => {
    console.log('useEffect triggered - selectedProject changed:', selectedProject);
    console.log('selectedProject type:', typeof selectedProject);
    console.log('selectedProject.id:', selectedProject?.id);
    
    if (selectedProject && selectedProject.id) {
      console.log('useEffect: selectedProject changed, fetching documents for:', selectedProject.id);
      fetchDocuments();
    } else {
      console.log('useEffect: selectedProject is not ready yet, skipping fetchDocuments');
    }
  }, [selectedProject]);

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
          const response = await fetch(`/api/ai/job-status/${selectedProject.id}`, {
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
    if (!files?.length || !selectedProject) return;

    console.log('=== AI Page File Upload Started ===');
    console.log('Files to upload:', Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })));
    console.log('Selected project:', selectedProject.id, selectedProject.name);

    setIsUploadingDoc(true);

    try {
      for (const file of Array.from(files)) {
        console.log('📤 Uploading file:', file.name);
        
        const formData = new FormData();
        formData.append('file', file);
        
        // Get authentication headers
        console.log('🔐 Getting authentication session...');
        const session = await getCurrentSession();
        console.log('Session status:', session ? 'valid' : 'null');
        console.log('Session token preview:', session?.access_token ? session.access_token.substring(0, 20) + '...' : 'none');
        
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        
        console.log('🌐 Making upload request to:', `/api/connected-workflow/upload-document/${selectedProject.id}`);
        console.log('Request headers:', headers);
        
        const response = await fetch(`/api/connected-workflow/upload-document/${selectedProject.id}`, {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        });
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ Upload failed with status:', response.status);
          console.error('❌ Error data:', errorData);
          throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Upload response data:', data);
        
        if (!data.success) {
          throw new Error(data.error || 'Upload failed');
        }
        
        console.log('✅ File uploaded successfully:', file.name);
      }
      
      console.log('🔄 Fetching updated document list...');
      // After all uploads, fetch updated document list
      await fetchDocuments();
      console.log('✅ Document list updated');
      
      toast({
        title: 'Upload Successful',
        description: `Successfully uploaded ${files.length} document(s)`,
      });
    } catch (error) {
      console.error('❌ Error uploading document:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      // Call backend AI API for project-specific Q&A
      const response = await fetch(`/api/connected-workflow/ask-question/${selectedProject.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: inputValue })
      });
      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.answer || 'Sorry, I could not process your question.',
        timestamp: new Date(),
        references: data.references
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        type: 'ai',
        content: "Sorry, I couldn't process your question. Please try again.",
        timestamp: new Date()
      }]);
    }
  };

  const handleHandwritingUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedProject) return;

    setIsProcessingHandwriting(true);

    try {
      const result = await scanHandwriting(files[0], selectedProject.id);
      setHandwritingResult(result);
      setShowHandwritingPreview(true);
    } catch (error) {
      console.error('Error processing handwriting:', error);
      toast({
        title: 'Processing Failed',
        description: 'Failed to process handwriting. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingHandwriting(false);
    }
  };

  const handleDownloadExcel = () => {
    if (handwritingResult?.excelUrl) {
      window.open(handwritingResult.excelUrl, '_blank');
    }
  };

  const handleGenerateLayout = async () => {
    if (!selectedProject) return;

    setIsGeneratingLayout(true);
    setJobStatus({ status: 'processing' });

    try {
      const result = await automateLayout(
        selectedProject.id,
        selectedProject.panels,
        selectedProject.documents
      );
      console.log('Layout generation result:', result);
      setJobStatus({ status: 'completed', created_at: new Date().toISOString() });
    } catch (error) {
      console.error('Error generating layout:', error);
      setJobStatus({ status: 'failed' });
    } finally {
      setIsGeneratingLayout(false);
    }
  };

  const handleProjectSelect = (project: any) => {
    selectProject(project.id);
    // Update URL to reflect selected project
    router.push(`/dashboard/ai?projectId=${project.id}`);
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

  // Show loading state while authentication is being verified
  if (loading) {
    return (
      <div className="ai-page">
        <div className="ai-header">
          <h1>AI Assistant</h1>
          <p>Upload documents, ask questions, and generate optimized panel layouts</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!selectedProjectId || !selectedProject ? (
        <NoProjectSelected message="Select a project to use AI features." />
      ) : (
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
                  Working on: {selectedProject.name}
                </span>
              )}
            </div>
            
            <div className="project-selector">
              {projects.length === 0 ? (
                <div className="no-projects">
                  <p>No projects found. Create a project first to use AI features.</p>
                  <div className="project-actions">
                    <button 
                      onClick={() => setShowProjectSelector(true)}
                      className="btn-create-project"
                    >
                      Choose Project
                    </button>
                  </div>
                </div>
              ) : (
                <div className="project-dropdown">
                  <label className="dropdown-label">
                    Select a project to enable AI features ({projects.filter(p => p.status === 'active').length} active projects available):
                  </label>
                  <select 
                    value={selectedProject?.id || ''} 
                    onChange={(e) => {
                      const project = projects.find(p => p.id === e.target.value);
                      selectProject(project?.id || '');
                      if (project) {
                        router.push(`/dashboard/ai?projectId=${project.id}`);
                      }
                    }}
                    className="project-select"
                  >
                    <option value="">Choose a project...</option>
                    {projects
                      .filter(project => project.status === 'active')
                      .map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name} - {project.location || 'No location'}
                        </option>
                      ))}
                  </select>
                  <button 
                    onClick={() => setShowProjectSelector(true)}
                    className="btn-new-project"
                  >
                    Choose Project
                  </button>
                </div>
              )}
            </div>
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
                {selectedProject && (
                  <span className="project-indicator">Project: {selectedProject.name}</span>
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
                        {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
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
                        <span className={`value status-${handwritingResult.validation.isValid ? 'valid' : 'invalid'}`}>
                          {handwritingResult.validation.isValid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                    </div>

                    {handwritingResult.validation.issues.length > 0 && (
                      <div className="validation-issues">
                        <h4>Issues Found:</h4>
                        <ul>
                          {handwritingResult.validation.issues.map((issue, index) => (
                            <li key={index} className="issue-item">{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="results-actions">
                      <button onClick={handleDownloadExcel} className="btn-download">
                        Download Excel Report
                      </button>
                      <button 
                        onClick={() => setShowHandwritingPreview(true)}
                        className="btn-preview"
                      >
                        Preview Data
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Layout Generation Section */}
            <div className="layout-section">
              <div className="section-header">
                <h2>Panel Layout Generation</h2>
                <button 
                  onClick={handleGenerateLayout}
                  disabled={!selectedProject || isGeneratingLayout}
                  className="btn-generate-layout"
                >
                  {isGeneratingLayout ? 'Generating...' : 'Generate Layout'}
                </button>
              </div>
              
              <div className="layout-info">
                <p>Generate optimized panel layouts based on your project requirements and uploaded documents.</p>
                {jobStatus.status === 'processing' && (
                  <div className="generation-status">
                    <div className="loading-spinner"></div>
                    <span>Generating optimized panel layout...</span>
                  </div>
                )}
                {jobStatus.status === 'completed' && (
                  <div className="generation-complete">
                    <span className="success-message">✓ Layout generated successfully!</span>
                    <button 
                      onClick={() => router.push(`/dashboard/projects/${selectedProject?.id}/panel-layout`)}
                      className="btn-view-layout"
                    >
                      View Layout
                    </button>
                  </div>
                )}
                {jobStatus.status === 'failed' && (
                  <div className="generation-failed">
                    <span className="error-message">✗ Failed to generate layout. Please try again.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Selector Modal */}
          <ProjectSelector
            isOpen={showProjectSelector}
            onClose={() => setShowProjectSelector(false)}
            onProjectSelect={handleProjectSelect}
          />
        </div>
      )}
    </>
  );
}