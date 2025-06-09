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

export default function AIAssistantPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>({ status: 'idle' });
  const [isGeneratingLayout, setIsGeneratingLayout] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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