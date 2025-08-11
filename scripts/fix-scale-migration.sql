-- Migration script to fix scale values from 0.0025 to 1.0
-- This fixes the issue where panels were nearly invisible due to extremely small scale

-- Update existing projects with scale = 0.0025 to scale = 1.0
UPDATE public.projects 
SET scale = 1.0 
WHERE scale = 0.0025 OR scale < 0.01;

-- Update existing panel layouts with scale = 0.0025 to scale = 1.0
UPDATE public.panel_layouts 
SET scale = 1.0 
WHERE scale = 0.0025 OR scale < 0.01;

-- Log the changes
DO $$
DECLARE
    projects_updated INTEGER;
    layouts_updated INTEGER;
BEGIN
    -- Count updated projects
    GET DIAGNOSTICS projects_updated = ROW_COUNT;
    
    -- Count updated panel layouts
    SELECT COUNT(*) INTO layouts_updated 
    FROM public.panel_layouts 
    WHERE scale = 1.0 AND (scale = 0.0025 OR scale < 0.01);
    
    RAISE NOTICE 'Migration completed: % projects and % panel layouts updated from 0.0025 to 1.0 scale', 
        projects_updated, layouts_updated;
END $$;

-- Verify the changes
SELECT 
    'Projects with scale < 0.01' as table_name,
    COUNT(*) as count,
    MIN(scale) as min_scale,
    MAX(scale) as max_scale
FROM public.projects 
WHERE scale < 0.01

UNION ALL

SELECT 
    'Panel layouts with scale < 0.01' as table_name,
    COUNT(*) as count,
    MIN(scale) as min_scale,
    MAX(scale) as max_scale
FROM public.panel_layouts 
WHERE scale < 0.01;
