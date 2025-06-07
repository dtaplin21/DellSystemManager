'use client';

import { useState } from 'react';
import './documents.css';

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Sample document data
  const documents = [
    {
      id: 1,
      name: 'Project Specifications',
      type: 'PDF',
      size: '2.4 MB',
      uploadedAt: '2025-05-01',
      project: 'Highway 101 Expansion',
    },
    {
      id: 2,
      name: 'QC Test Results',
      type: 'Excel',
      size: '1.8 MB',
      uploadedAt: '2025-05-03',
      project: 'Highway 101 Expansion',
    },
    {
      id: 3,
      name: 'Installation Guidelines',
      type: 'PDF',
      size: '3.2 MB',
      uploadedAt: '2025-04-28',
      project: 'Riverside Containment',
    },
    {
      id: 4,
      name: 'Material Certifications',
      type: 'PDF',
      size: '5.1 MB',
      uploadedAt: '2025-05-07',
      project: 'Airport Runway Expansion',
    },
    {
      id: 5,
      name: 'Panel Layout',
      type: 'CAD',
      size: '8.6 MB',
      uploadedAt: '2025-05-02',
      project: 'City Reservoir Project',
    },
  ];
  
  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getDocumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'excel':
        return '📊';
      case 'cad':
        return '📐';
      default:
        return '📋';
    }
  };

  const getDocumentIconClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'document-icon pdf';
      case 'excel':
        return 'document-icon excel';
      case 'cad':
        return 'document-icon cad';
      default:
        return 'document-icon default';
    }
  };

  const getTypeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'document-type-badge type-pdf';
      case 'excel':
        return 'document-type-badge type-excel';
      case 'cad':
        return 'document-type-badge type-cad';
      default:
        return 'document-type-badge type-default';
    }
  };

  const handleDownload = (docId: number) => {
    alert(`Download functionality ready! This will download document ${docId} when connected to backend.`);
  };

  const handleViewDetails = (docId: number) => {
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
                    <div className={getDocumentIconClass(doc.type)}>
                      {getDocumentIcon(doc.type)}
                    </div>
                    <div>
                      <h3 className="document-title">{doc.name}</h3>
                      <p className="document-project">{doc.project}</p>
                    </div>
                  </div>
                </div>
                <div className="document-card-body">
                  <div className="document-details">
                    <span className={getTypeClass(doc.type)}>{doc.type}</span>
                    <span>{doc.size}</span>
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