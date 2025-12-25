const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { supabase, pool, queryWithRetry } = require('../db');

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
router.get('/', auth, async (req, res, next) => {
  
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.error('Projects route: User not authenticated - req.user:', req.user);
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    console.log('Projects route: Fetching projects for user:', req.user.id);
    
    // Use direct PostgreSQL query with retry logic to bypass RLS issues
    // This is more efficient for backend operations and avoids RLS policy conflicts
    const result = await queryWithRetry(
      `SELECT id, name, description, location, status, created_at, updated_at 
       FROM projects 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [req.user.id],
      3 // 3 retries with exponential backoff
    );
    
    const projects = result.rows;
    console.log('Projects route: Found projects:', projects?.length || 0);
    
    // Format the data for the frontend
    const formattedProjects = projects.map(project => ({
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
    console.error('Error stack:', error.stack);
    
    // Check if it's a connection/timeout error
    if (error.message.includes('timeout') || 
        error.message.includes('Connection terminated') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')) {
      return res.status(503).json({ 
        message: 'Database connection timeout. Please try again.',
        error: error.message || 'Unknown error',
        code: 'DATABASE_TIMEOUT',
        retryable: true
      });
    }
    
    return res.status(500).json({ 
      message: 'Failed to fetch projects',
      error: error.message || 'Unknown error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get project by ID (authenticated)
router.get('/:id', async (req, res, next) => {
  // Apply auth middleware for production
  try {
    await auth(req, res, () => {});
  } catch (error) {
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }
  
  try {
    const { id } = req.params;
    
    // Get project for authenticated user using direct PostgreSQL query with retry
    const result = await queryWithRetry(
      `SELECT id, name, description, location, status, created_at, updated_at 
       FROM projects 
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
      3
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const project = result.rows[0];
    res.status(200).json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      location: project.location,
      created_at: project.created_at,
      updated_at: project.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// Get project by ID (SSR - no auth required)
router.get('/ssr/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get project without user authentication for SSR using direct PostgreSQL query with retry
    const result = await queryWithRetry(
      `SELECT id, name, description, location, status, created_at, updated_at 
       FROM projects 
       WHERE id = $1`,
      [id],
      3
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const project = result.rows[0];
    res.status(200).json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      location: project.location,
      created_at: project.created_at,
      updated_at: project.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// Create new project
router.post('/', auth, async (req, res, next) => {
  try {
    const projectData = req.body;
    console.log('Received project data:', projectData);
    
    // Validate project data
    const { error } = validateProject(projectData);
    if (error) {
      console.error('Validation error:', error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const now = new Date().toISOString();
    const projectId = uuidv4();
    
    // Create new project using direct PostgreSQL query with retry
    const result = await queryWithRetry(
      `INSERT INTO projects (id, user_id, name, description, status, location, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, status, location, created_at, updated_at`,
      [
        projectId,
        req.user.id,
        projectData.name,
        projectData.description || '',
        projectData.status || 'active',
        projectData.location || '',
        now,
        now
      ],
      3
    );
    
    if (result.rows.length === 0) {
      console.error('Error creating project: No rows returned');
      return res.status(500).json({ 
        message: 'Failed to create project',
        code: 'DATABASE_ERROR'
      });
    }
    
    const newProject = result.rows[0];
    console.log('Created project:', newProject);
    
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
    console.error('Project creation error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      message: 'Failed to create project',
      error: error.message || 'Unknown error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Update project
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if project exists and belongs to user using direct PostgreSQL query with retry
    const checkResult = await queryWithRetry(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
      3
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Validate update data
    const { error } = validateProject(updateData);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Build dynamic update query to handle optional fields including cardinal_direction
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (updateData.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(updateData.name);
    }
    if (updateData.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(updateData.description);
    }
    if (updateData.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(updateData.status);
    }
    if (updateData.location !== undefined) {
      updateFields.push(`location = $${paramIndex++}`);
      updateValues.push(updateData.location);
    }
    if (updateData.cardinalDirection !== undefined) {
      updateFields.push(`cardinal_direction = $${paramIndex++}`);
      updateValues.push(updateData.cardinalDirection);
    }
    
    updateFields.push(`updated_at = $${paramIndex++}`);
    updateValues.push(new Date().toISOString());
    
    updateValues.push(id, req.user.id);
    
    const updateQuery = `UPDATE projects 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING id, name, description, status, location, cardinal_direction, created_at, updated_at`;
    
    const updateResult = await queryWithRetry(updateQuery, updateValues, 3);
    
    if (updateResult.rows.length === 0) {
      console.error('Error updating project: No rows returned');
      return res.status(500).json({ message: 'Failed to update project' });
    }
    
    const updatedProject = updateResult.rows[0];
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
    console.error('Project update error:', error);
    next(error);
  }
});

// Delete project
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if project exists and belongs to user using direct PostgreSQL query with retry
    const checkResult = await queryWithRetry(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
      3
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Delete project using direct PostgreSQL query with retry
    const deleteResult = await queryWithRetry(
      `DELETE FROM projects WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
      3
    );
    
    if (deleteResult.rowCount === 0) {
      console.error('Error deleting project: No rows deleted');
      return res.status(500).json({ message: 'Failed to delete project' });
    }
    
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Project deletion error:', error);
    next(error);
  }
});

module.exports = router;
