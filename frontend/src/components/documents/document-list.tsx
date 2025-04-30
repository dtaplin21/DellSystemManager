'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatFileSize, formatDate } from '@/lib/utils';
import { deleteDocument } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

interface DocumentListProps {
  documents: Document[];
  onDelete: (documentId: string) => void;
}

export default function DocumentList({ documents, onDelete }: DocumentListProps) {
  const [isDeleting, setIsDeleting] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();
  const router = useRouter();

  const getDocumentIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('pdf')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M9 15L12 15 12 10"></path>
          <path d="M5 12h2"></path>
          <path d="M12 10h2"></path>
        </svg>
      );
    } else if (lowerType.includes('excel') || lowerType.includes('spreadsheet') || lowerType.includes('xls')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="8" y1="13" x2="16" y2="13"></line>
          <line x1="8" y1="17" x2="16" y2="17"></line>
          <line x1="10" y1="9" x2="12" y2="9"></line>
        </svg>
      );
    } else if (lowerType.includes('word') || lowerType.includes('doc')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <line x1="10" y1="9" x2="8" y2="9"></line>
        </svg>
      );
    } else {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      );
    }
  };

  const handleDelete = async (documentId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        setIsDeleting(prev => ({ ...prev, [documentId]: true }));
        await deleteDocument(documentId);
        onDelete(documentId);
        toast({
          title: 'Document Deleted',
          description: 'Document has been deleted successfully.',
        });
      } catch (error) {
        toast({
          title: 'Delete Failed',
          description: 'Failed to delete document. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsDeleting(prev => ({ ...prev, [documentId]: false }));
      }
    }
  };

  const handleDownload = (document: Document) => {
    // In a real application, this would initiate a download
    toast({
      title: 'Download Started',
      description: `Downloading ${document.name}...`,
    });
  };

  if (documents.length === 0) {
    return (
      <div className="py-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-400 mb-4">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <h3 className="text-lg font-semibold text-gray-900">No Documents Found</h3>
        <p className="text-gray-500 mt-1 mb-4">
          Upload some documents to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Document</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Size</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Uploaded</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Uploaded By</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {documents.map((document) => (
              <tr key={document.id} className="hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    {getDocumentIcon(document.type)}
                    <span className="ml-2 text-sm font-medium">{document.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {formatFileSize(document.size)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {formatDate(document.uploadedAt)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {document.uploadedBy}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(document)}
                    >
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(document.id)}
                      disabled={isDeleting[document.id]}
                    >
                      {isDeleting[document.id] ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
