'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { useProjects } from '@/contexts/ProjectsProvider';
import { getCurrentSession } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import NoProjectSelected from '@/components/ui/no-project-selected';
import './documents.css';

interface Document {
  id: string;
  name: string;
  uploadedAt: string;
  projectId: string;
  type: string;
  size: number;
  status?: string;
}

export default function DocumentsPage() {
  const { selectedProjectId, selectedProject } = useProjects();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ FIXED: Move early return after all hooks
  // Fetch documents for the selected project
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!selectedProjectId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/documents/${selectedProjectId}`, {
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

  const handleDownload = (docId: string) => {
    alert(`Download functionality ready! This will download document ${docId} when connected to backend.`);
  };

  const handleViewDetails = (docId: string) => {
    alert(`View details functionality ready! This will show document ${docId} details when connected to backend.`);
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
        const formData = new FormData();
        Array.from(files).forEach(file => {
          formData.append('documents', file);
        });
        
        // Get authentication headers
        console.log('🔐 Getting authentication session...');
        const session = await getCurrentSession();
        console.log('Session status:', session ? 'valid' : 'null');
        console.log('Session token preview:', session?.access_token ? session.access_token.substring(0, 20) + '...' : 'none');
        
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        
        console.log('🌐 Making upload request to:', `/api/documents/${selectedProjectId}/upload`);
        console.log('Request headers:', headers);
        
        const response = await fetch(`/api/documents/${selectedProjectId}/upload`, {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        });
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Upload response data:', data);
          
          // Refresh the documents list
          console.log('🔄 Fetching updated document list...');
          const docsResponse = await fetch(`/api/documents/${selectedProjectId}`, {
            credentials: 'include',
          });
          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            setDocuments(docsData);
            console.log('✅ Document list updated');
          }
          setShowUploadModal(false);
          toast({
            title: 'Upload Successful',
            description: `Successfully uploaded ${data.documents.length} document(s)`,
          });
        } else {
          const errorData = await response.json();
          console.error('❌ Upload failed with status:', response.status);
          console.error('❌ Error data:', errorData);
          toast({
            title: 'Upload Failed',
            description: errorData.message || 'Unknown error',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('❌ Upload error:', error);
        toast({
          title: 'Upload Failed',
          description: 'Upload failed. Please try again.',
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