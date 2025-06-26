-- Comprehensive RLS Policies for Supabase Auth Migration
-- Run this in your Supabase SQL editor after creating the profiles table

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROJECTS TABLE POLICIES
-- ============================================================================

-- Users can view their own projects
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can insert their own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PANEL_LAYOUTS TABLE POLICIES
-- ============================================================================

-- Users can view panel layouts from their projects
CREATE POLICY "Users can view panel layouts from their projects" ON public.panel_layouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can insert panel layouts to their projects
CREATE POLICY "Users can insert panel layouts to their projects" ON public.panel_layouts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update panel layouts from their projects
CREATE POLICY "Users can update panel layouts from their projects" ON public.panel_layouts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can delete panel layouts from their projects
CREATE POLICY "Users can delete panel layouts from their projects" ON public.panel_layouts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- DOCUMENTS TABLE POLICIES
-- ============================================================================

-- Users can view documents from their projects
CREATE POLICY "Users can view documents from their projects" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = documents.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can insert documents to their projects
CREATE POLICY "Users can insert documents to their projects" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = documents.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update documents from their projects
CREATE POLICY "Users can update documents from their projects" ON public.documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = documents.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can delete documents from their projects
CREATE POLICY "Users can delete documents from their projects" ON public.documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = documents.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- QC_DATA TABLE POLICIES
-- ============================================================================

-- Users can view QC data from their projects
CREATE POLICY "Users can view QC data from their projects" ON public.qc_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = qc_data.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can insert QC data to their projects
CREATE POLICY "Users can insert QC data to their projects" ON public.qc_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = qc_data.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update QC data from their projects
CREATE POLICY "Users can update QC data from their projects" ON public.qc_data
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = qc_data.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can delete QC data from their projects
CREATE POLICY "Users can delete QC data from their projects" ON public.qc_data
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = qc_data.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own notifications
CREATE POLICY "Users can insert their own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own notifications
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.panel_layouts TO authenticated;
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.qc_data TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Grant sequence permissions for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated; 