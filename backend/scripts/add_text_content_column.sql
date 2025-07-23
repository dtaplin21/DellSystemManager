-- Migration: Add text_content column to documents table
-- This migration adds a text_content column to store extracted text from documents

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS text_content TEXT;

-- Add an index on text_content for better performance when searching
CREATE INDEX IF NOT EXISTS idx_documents_text_content 
ON documents USING gin(to_tsvector('english', text_content));

-- Add a comment to document the column
COMMENT ON COLUMN documents.text_content IS 'Extracted text content from the document for AI analysis'; 