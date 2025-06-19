import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Get user from auth header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];
      
      // Verify the token and get user
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Fetch user's projects
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, name, description, location, status, created_at, updated_at')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        return res.status(500).json({ error: 'Failed to fetch projects' });
      }

      res.status(200).json(projects);
    } catch (error) {
      console.error('Error in GET /api/projects:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      // Get user from auth header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];
      
      // Verify the token and get user
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { name, description, location, panels } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      // Create new project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          owner_id: user.id,
          name,
          description,
          location,
          status: 'active'
        })
        .select()
        .single();

      if (projectError) {
        console.error('Error creating project:', projectError);
        return res.status(500).json({ error: 'Failed to create project' });
      }

      // If panels data is provided, insert panels
      if (panels && Array.isArray(panels) && panels.length > 0) {
        const panelsToInsert = panels.map(panel => ({
          project_id: project.id,
          type: panel.type || 'rectangle',
          x: panel.x || 0,
          y: panel.y || 0,
          width_feet: panel.widthFeet || 10,
          height_feet: panel.heightFeet || 10,
          roll_number: panel.rollNumber || '',
          panel_number: panel.panelNumber || '',
          fill: panel.fill || '#3b82f6',
          stroke: panel.stroke || '#1d4ed8',
          stroke_width: panel.strokeWidth || 2,
          rotation: panel.rotation || 0
        }));

        const { error: panelsError } = await supabase
          .from('panels')
          .insert(panelsToInsert);

        if (panelsError) {
          console.error('Error creating panels:', panelsError);
          // Note: We don't fail here, just log the error
        }
      }

      res.status(201).json(project);
    } catch (error) {
      console.error('Error in POST /api/projects:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 