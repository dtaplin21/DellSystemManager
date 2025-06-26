-- Check database structure and RLS policies
-- Run this in your Supabase SQL editor

-- Check if panel_layouts table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('panel_layouts', 'panels', 'projects');

-- Check table structure for panel_layouts
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'panel_layouts'
ORDER BY ordinal_position;

-- Check if RLS is enabled on panel_layouts
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'panel_layouts';

-- Check existing RLS policies
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
WHERE tablename IN ('panel_layouts', 'panels');

-- Check if there are any rows in panel_layouts
SELECT COUNT(*) as row_count FROM public.panel_layouts;

-- Check if there are any rows in projects
SELECT COUNT(*) as project_count FROM public.projects; 