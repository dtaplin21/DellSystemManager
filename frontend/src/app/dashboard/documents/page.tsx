'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { useProjects } from '@/contexts/ProjectsProvider';
import { getCurrentSession } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import NoProjectSelected from '@/components/ui/no-project-selected';
import AIAnalysis from '@/components/documents/ai-analysis';
import { uploadDocument, fetchDocuments, getAuthHeaders } from '@/lib/api';
import config from '@/lib/config';
import './documents.css';

interface Document {
  id: string;
  name: string;
  uploadedAt: string;
  projectId: string;
  type: string;
  size: number;
  status?: string;
  textContent?: string;
}

export default function DocumentsPage() {
  const { selectedProjectId, selectedProject } = useProjects();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'documents' | 'ai-analysis' | 'asbuilt'>('documents');

  
  // ✅ FIXED: Move early return after all hooks
  // Fetch documents for the selected project
  useEffect(() => {
    const loadDocuments = async () => {
      if (!selectedProjectId) return;
      
      setIsLoading(true);
      try {
        const data = await fetchDocuments(selectedProjectId);
        setDocuments(data);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setDocuments([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, [selectedProjectId]);
  
  // ✅ FIXED: Early return moved after all hooks
  if (!selectedProjectId || !selectedProject) {
    return <NoProjectSelected message="Select a project to view documents." />;
  }
  
  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getDocumentIcon = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'xlsx':
      case 'xls':
        return '📊';
      case 'dwg':
      case 'dxf':
        return '📐';
      default:
        return '📋';
    }
  };

  const getDocumentIconClass = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'document-icon pdf';
      case 'xlsx':
      case 'xls':
        return 'document-icon excel';
      case 'dwg':
      case 'dxf':
        return 'document-icon cad';
      default:
        return 'document-icon default';
    }
  };

  const getTypeClass = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'document-type-badge type-pdf';
      case 'xlsx':
      case 'xls':
        return 'document-type-badge type-excel';
      case 'dwg':
      case 'dxf':
        return 'document-type-badge type-cad';
      default:
        return 'document-type-badge type-default';
    }
  };

  const getFileType = (name: string) => {
    const extension = name.split('.').pop()?.toUpperCase();
    return extension || 'FILE';
  };

  const getFileSize = (size?: number) => {
    if (!size) return 'Unknown size';
    const bytes = size;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = async (docId: string) => {
    try {
      const selectedDoc = documents.find(d => d.id === docId);
      if (!selectedDoc) {
        toast({
          title: 'Error',
          description: 'Document not found.',
          variant: 'destructive',
        });
        return;
      }

      // Show loading toast
      toast({
        title: 'Downloading...',
        description: `Preparing ${selectedDoc.name} for download.`,
      });

      // Use the download endpoint with download parameter
      const response = await fetch(`${config.endpoints.documents(selectedProjectId)}/download/${docId}?download=true`, {
        headers: await getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedDoc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Complete',
        description: `${selectedDoc.name} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download document. Please try again.',
        variant: 'destructive',
      });
    }
  };



  const handleUpload = async () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.pdf,.xls,.xlsx,.doc,.docx,.txt,.csv,.dwg,.dxf';
    
    fileInput.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      console.log('=== Documents Page File Upload Started ===');
      console.log('Files to upload:', Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })));
      console.log('Selected project ID:', selectedProjectId);
      
      try {
        // Upload each file using the API helper
        for (const file of Array.from(files)) {
          console.log('📤 Uploading file:', file.name);
          await uploadDocument(selectedProjectId, file);
        }
        
        // Refresh the documents list
        console.log('🔄 Fetching updated document list...');
        const docsData = await fetchDocuments(selectedProjectId);
        setDocuments(docsData);
        console.log('✅ Document list updated');
        
        setShowUploadModal(false);
        toast({
          title: 'Upload Successful',
          description: `Successfully uploaded ${files.length} document(s)`,
        });
      } catch (error) {
        console.error('❌ Upload error:', error);
        toast({
          title: 'Upload Failed',
          description: error instanceof Error ? error.message : 'Upload failed. Please try again.',
          variant: 'destructive',
        });
      }
    };
    
    fileInput.click();
  };

  return (
    <div className="documents-page">
      <div className="documents-container">
        <div className="documents-header">
          <h1 className="documents-title">Documents</h1>
          <div className="documents-tabs">
            <button 
              className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveTab('documents')}
            >
              📄 Documents
            </button>
            <button 
              className={`tab-button ${activeTab === 'ai-analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai-analysis')}
            >
              🤖 AI Analysis
            </button>
            <button 
              className={`tab-button ${activeTab === 'asbuilt' ? 'active' : ''}`}
              onClick={() => setActiveTab('asbuilt')}
            >
              🏗️ As-Built Data
            </button>
          </div>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn-upload"
            data-testid="upload-document-button"
          >
            📤 Upload Document
          </button>
        </div>
        
        {activeTab === 'documents' ? (
          <>
            <div className="search-section">
              <div className="search-container">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search documents by name, project, or type..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="documents-grid">
              {isLoading ? (
                <div className="loading-state">
                  <div className="loading-icon">⏳</div>
                  <p>Loading documents...</p>
                </div>
              ) : filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => (
                  <div key={doc.id} className="document-card">
                    <div className="document-card-header">
                      <div className="document-header-content">
                        <div className={getDocumentIconClass(doc.name)}>
                          {getDocumentIcon(doc.name)}
                        </div>
                        <div>
                          <h3 className="document-title">{doc.name}</h3>
                          <p className="document-project">{doc.type}</p>
                        </div>
                      </div>
                    </div>
                    <div className="document-card-body">
                      <div className="document-details">
                        <span className={getTypeClass(doc.name)}>{getFileType(doc.name)}</span>
                        <span>{getFileSize(doc.size)}</span>
                      </div>
                      <div className="document-uploaded">
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                      <div className="document-actions">
                        <button 
                          onClick={() => handleDownload(doc.id)}
                          className="btn-action primary"
                        >
                          📥 Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📄</div>
                  <h3 className="empty-title">No documents found</h3>
                  <p className="empty-message">
                    {searchQuery
                      ? `No documents matching "${searchQuery}"`
                      : "Upload documents to get started."}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'ai-analysis' ? (
          <div className="ai-analysis-section">
            <AIAnalysis 
              projectId={selectedProjectId} 
              documents={documents}
            />
          </div>
        ) : (
          <div className="asbuilt-section">
            <div className="asbuilt-header">
              <h2>As-Built Data Management</h2>
              <p>Manage and view as-built records for panels, seaming, testing, and more.</p>
            </div>
            
            <div className="asbuilt-stats">
              <div className="stat-card">
                <h3>Total Records</h3>
                <p className="stat-number">0</p>
                <p className="stat-label">No data available</p>
              </div>
              <div className="stat-card">
                <h3>Domains</h3>
                <p className="stat-number">6</p>
                <p className="stat-label">Panel Placement, Seaming, Testing, etc.</p>
              </div>
              <div className="stat-card">
                <h3>Status</h3>
                <p className="stat-number">Empty</p>
                <p className="stat-label">Ready for data import</p>
              </div>
            </div>
            
            <div className="asbuilt-actions">
              <button className="btn-action primary">
                📊 Import Excel Data
              </button>
              <button className="btn-action secondary">
                ✏️ Manual Entry
              </button>
              <button className="btn-action secondary">
                📋 View All Records
              </button>
            </div>
            
            <div className="asbuilt-message">
              <p>No as-built data has been imported yet. Use the panel layout tool to start collecting data, or import existing Excel files.</p>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="upload-modal">
            <div className="upload-modal-content">
              <div className="upload-modal-header">
                <h2 className="upload-modal-title">Upload Document</h2>
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              
              <div className="upload-area">
                <div className="upload-icon">📤</div>
                <p className="upload-text">Drop files here or click to browse</p>
                <p className="upload-subtext">Support for PDF, Excel, CAD, and other document formats</p>
              </div>
              
              <div className="document-actions">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="btn-action"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  className="btn-action primary"
                >
                  Upload Files
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .asbuilt-section {
          padding: 2rem;
          background: #f8fafc;
          border-radius: 12px;
          margin-top: 1rem;
        }
        
        .asbuilt-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .asbuilt-header h2 {
          font-size: 2rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 0.5rem;
        }
        
        .asbuilt-header p {
          color: #64748b;
          font-size: 1.1rem;
        }
        
        .asbuilt-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }
        
        .stat-card h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .stat-number {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 0.25rem;
        }
        
        .stat-label {
          font-size: 0.875rem;
          color: #64748b;
        }
        
        .asbuilt-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }
        
        .btn-action {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.875rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .btn-action.primary {
          background: #3b82f6;
          color: white;
        }
        
        .btn-action.primary:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }
        
        .btn-action.secondary {
          background: white;
          color: #64748b;
          border: 1px solid #d1d5db;
        }
        
        .btn-action.secondary:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }
        
        .asbuilt-message {
          background: #f1f5f9;
          padding: 1.5rem;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        
        .asbuilt-message p {
          color: #64748b;
          margin: 0;
          font-size: 1rem;
        }
      `}</style>
    </div>
  );
}