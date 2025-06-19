import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

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

  if (req.method === 'GET') {
    try {
      // Fetch project with panels
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('owner_id', user.id)
        .single();

      if (projectError) {
        if (projectError.code === 'PGRST116') {
          return res.status(404).json({ error: 'Project not found' });
        }
        console.error('Error fetching project:', projectError);
        return res.status(500).json({ error: 'Failed to fetch project' });
      }

      // Fetch panels for this project
      const { data: panels, error: panelsError } = await supabase
        .from('panels')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: true });

      if (panelsError) {
        console.error('Error fetching panels:', panelsError);
        return res.status(500).json({ error: 'Failed to fetch panels' });
      }

      res.status(200).json({
        ...project,
        panels: panels || []
      });
    } catch (error) {
      console.error('Error in GET /api/projects/[id]:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { name, description, location, status, scale, layoutWidth, layoutHeight, panels } = req.body;

      // Update project metadata
      const projectUpdate = {};
      if (name !== undefined) projectUpdate.name = name;
      if (description !== undefined) projectUpdate.description = description;
      if (location !== undefined) projectUpdate.location = location;
      if (status !== undefined) projectUpdate.status = status;
      if (scale !== undefined) projectUpdate.scale = scale;
      if (layoutWidth !== undefined) projectUpdate.layout_width = layoutWidth;
      if (layoutHeight !== undefined) projectUpdate.layout_height = layoutHeight;

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .update(projectUpdate)
        .eq('id', id)
        .eq('owner_id', user.id)
        .select()
        .single();

      if (projectError) {
        console.error('Error updating project:', projectError);
        return res.status(500).json({ error: 'Failed to update project' });
      }

      // If panels data is provided, update panels
      if (panels && Array.isArray(panels)) {
        // Delete existing panels
        const { error: deleteError } = await supabase
          .from('panels')
          .delete()
          .eq('project_id', id);

        if (deleteError) {
          console.error('Error deleting existing panels:', deleteError);
        }

        // Insert new panels
        if (panels.length > 0) {
          const panelsToInsert = panels.map(panel => ({
            project_id: id,
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
            console.error('Error updating panels:', panelsError);
          }
        }
      }

      res.status(200).json(project);
    } catch (error) {
      console.error('Error in PUT /api/projects/[id]:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Delete project (panels will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);

      if (error) {
        console.error('Error deleting project:', error);
        return res.status(500).json({ error: 'Failed to delete project' });
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error in DELETE /api/projects/[id]:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 