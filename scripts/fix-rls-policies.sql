-- Fix RLS Policies for panel_layouts table
-- Run this in your Supabase SQL editor

-- First, drop the incorrect policies on the 'panels' table (if they exist)
DROP POLICY IF EXISTS "Users can view panels from their projects" ON public.panels;
DROP POLICY IF EXISTS "Users can insert panels to their projects" ON public.panels;
DROP POLICY IF EXISTS "Users can update panels from their projects" ON public.panels;
DROP POLICY IF EXISTS "Users can delete panels from their projects" ON public.panels;

-- Enable RLS on panel_layouts table
ALTER TABLE public.panel_layouts ENABLE ROW LEVEL SECURITY;

-- Create correct policies for panel_layouts table
CREATE POLICY "Users can view panel layouts from their projects" ON public.panel_layouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert panel layouts to their projects" ON public.panel_layouts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update panel layouts from their projects" ON public.panel_layouts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete panel layouts from their projects" ON public.panel_layouts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = panel_layouts.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Grant permissions to authenticated users
GRANT ALL ON public.panel_layouts TO authenticated;

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'panel_layouts'; 