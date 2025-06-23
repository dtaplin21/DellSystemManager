'use client';

import { useState, useEffect } from 'react';
import { useProjects } from '@/contexts/ProjectsProvider';
import NoProjectSelected from '@/components/ui/no-project-selected';
import './documents.css';

interface Document {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
  projectId: string;
  fileSize?: number;
  mimeType?: string;
  status?: string;
}

export default function DocumentsPage() {
  const { selectedProjectId, selectedProject } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Project selection guard
  if (!selectedProjectId || !selectedProject) {
    return <NoProjectSelected message="Select a project to view documents." />;
  }

  // Fetch documents for the selected project
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!selectedProjectId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/documents?projectId=${selectedProjectId}`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          setDocuments(data);
        } else {
          console.error('Failed to fetch documents:', response.status);
          setDocuments([]);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        setDocuments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [selectedProjectId]);
  
  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getDocumentIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
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

  const getDocumentIconClass = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
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

  const getTypeClass = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
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

  const getFileType = (filename: string) => {
    const extension = filename.split('.').pop()?.toUpperCase();
    return extension || 'FILE';
  };

  const getFileSize = (fileSize?: number) => {
    if (!fileSize) return 'Unknown size';
    const bytes = fileSize;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = (docId: string) => {
    alert(`Download functionality ready! This will download document ${docId} when connected to backend.`);
  };

  const handleViewDetails = (docId: string) => {
    alert(`View details functionality ready! This will show document ${docId} details when connected to backend.`);
  };

  const handleUpload = () => {
    alert('Upload functionality ready! This will connect to your backend when ready.');
    setShowUploadModal(false);
  };

  return (
    <div className="documents-page">
      <div className="documents-container">
        <div className="documents-header">
          <h1 className="documents-title">Documents</h1>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn-upload"
          >
            📤 Upload Document
          </button>
        </div>
        
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
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-card-header">
                  <div className="document-header-content">
                    <div className={getDocumentIconClass(doc.filename)}>
                      {getDocumentIcon(doc.filename)}
                    </div>
                    <div>
                      <h3 className="document-title">{doc.name}</h3>
                      <p className="document-project">{doc.filename}</p>
                    </div>
                  </div>
                </div>
                <div className="document-card-body">
                  <div className="document-details">
                    <span className={getTypeClass(doc.filename)}>{getFileType(doc.filename)}</span>
                    <span>{getFileSize(doc.fileSize)}</span>
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
                    <button 
                      onClick={() => handleViewDetails(doc.id)}
                      className="btn-action"
                    >
                      👁️ Details
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
    </div>
  );
}