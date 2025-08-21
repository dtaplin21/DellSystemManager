const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { supabase } = require('../db');

// Simple validation function
const validateProject = (projectData) => {
  const errors = [];
  
  if (!projectData.name || projectData.name.trim().length === 0) {
    errors.push('Project name is required');
  }
  
  if (projectData.name && projectData.name.trim().length < 2) {
    errors.push('Project name must be at least 2 characters long');
  }
  
  return { error: errors.length > 0 ? { details: [{ message: errors.join(', ') }] } : null };
};

// Get all projects for the current user
router.get('/', async (req, res, next) => {
  // Development mode bypass
  if (process.env.NODE_ENV === 'development' && req.headers['x-development-mode'] === 'true') {
    console.log('🔧 [DEV] Development mode bypass for projects');
    req.user = { id: '00000000-0000-0000-0000-0000-000000000000', email: 'dev@example.com', isAdmin: true };
  } else {
    // Apply auth middleware for production
    try {
      await auth(req, res, () => {});
    } catch (error) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
  }
  try {
    console.log('Projects route: Fetching projects for user:', req.user.id);
    
    // Use Supabase to fetch projects
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, description, location, status, created_at, updated_at')
      .order('updated_at', { ascending: false });
    
    // In development mode, if no projects found for dev user, try to find any projects
    if (process.env.NODE_ENV === 'development' && req.headers['x-development-mode'] === 'true') {
      console.log('🔧 [DEV] Fetching all projects in development mode');
      // Don't filter by user_id in development mode
    } else {
      projectsQuery = projectsQuery.eq('user_id', req.user.id);
    }
    
    const { data: projects, error } = await projectsQuery;
    
    if (error) {
      console.error('Error fetching projects from Supabase:', error);
      return res.status(500).json({ message: 'Failed to fetch projects' });
    }
    
    console.log('Projects route: Found projects:', projects?.length || 0);
    
    // Format the data for the frontend
    const formattedProjects = (projects || []).map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      location: project.location,
      status: project.status,
      created_at: project.created_at,
      updated_at: project.updated_at,
    }));
    
    res.status(200).json(formattedProjects);
  } catch (error) {
    console.error('Projects route: Error fetching projects:', error);
    next(error);
  }
});

// Get project by ID
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (error || !projects) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.status(200).json({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      location: projects.location,
      created_at: projects.created_at,
      updated_at: projects.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// Create new project
router.post('/', auth, async (req, res, next) => {
  try {
    const projectData = req.body;
    console.log('Received project data:', projectData); // Debug log
    
    // Validate project data
    const { error } = validateProject(projectData);
    if (error) {
      console.error('Validation error:', error.details[0].message); // Debug log
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const now = new Date().toISOString();
    
    // Create new project using Supabase
    const { data: newProject, error: insertError } = await supabase
      .from('projects')
      .insert({
        id: uuidv4(),
        user_id: req.user.id,
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status || 'active',
        location: projectData.location || '',
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating project in Supabase:', insertError);
      return res.status(500).json({ message: 'Failed to create project' });
    }
    
    console.log('Created project:', newProject); // Debug log
    
    // Return the new project
    res.status(201).json({
      id: newProject.id,
      name: newProject.name,
      description: newProject.description,
      status: newProject.status,
      location: newProject.location,
      created_at: newProject.created_at,
      updated_at: newProject.updated_at,
    });
  } catch (error) {
    console.error('Project creation error:', error); // Debug log
    next(error);
  }
});

// Update project
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if project exists and belongs to user
    const { data: existingProject, error: checkError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (checkError || !existingProject) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Update project using Supabase
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        name: updateData.name || existingProject.name,
        description: updateData.description !== undefined ? updateData.description : existingProject.description,
        status: updateData.status || existingProject.status,
        location: updateData.location !== undefined ? updateData.location : existingProject.location,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating project in Supabase:', updateError);
      return res.status(500).json({ message: 'Failed to update project' });
    }
    
    res.status(200).json({
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      status: updatedProject.status,
      location: updatedProject.location,
      created_at: updatedProject.created_at,
      updated_at: updatedProject.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if project exists and belongs to user
    const { data: existingProject, error: checkError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (checkError || !existingProject) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Delete dependent data first to satisfy foreign key constraints
    // 1) Delete documents for the project
    const { error: docsDeleteError } = await supabase
      .from('documents')
      .delete()
      .eq('project_id', id);
    if (docsDeleteError) {
      console.error('Error deleting project documents from Supabase:', docsDeleteError);
      return res.status(500).json({ message: 'Failed to delete project documents' });
    }

    // 2) Delete QC data for the project
    const { error: qcDeleteError } = await supabase
      .from('qc_data')
      .delete()
      .eq('project_id', id);
    if (qcDeleteError) {
      console.error('Error deleting project QC data from Supabase:', qcDeleteError);
      return res.status(500).json({ message: 'Failed to delete project QC data' });
    }

    // 3) Delete panel layouts for the project
    const { error: panelsDeleteError } = await supabase
      .from('panel_layouts')
      .delete()
      .eq('project_id', id);
    if (panelsDeleteError) {
      console.error('Error deleting project panel layouts from Supabase:', panelsDeleteError);
      return res.status(500).json({ message: 'Failed to delete panel layouts' });
    }

    // 4) Delete panel layout requirements for the project
    const { error: reqsDeleteError } = await supabase
      .from('panel_layout_requirements')
      .delete()
      .eq('project_id', id);
    if (reqsDeleteError) {
      console.error('Error deleting project panel requirements from Supabase:', reqsDeleteError);
      return res.status(500).json({ message: 'Failed to delete panel requirements' });
    }

    // Finally, delete the project itself
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);
    
    if (deleteError) {
      console.error('Error deleting project from Supabase:', deleteError);
      return res.status(500).json({ message: 'Failed to delete project' });
    }
    
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
