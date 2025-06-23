const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { validateProject } = require('../utils/validate');
const { db } = require('../db');
const { projects, panels, qcData } = require('../db/schema');
const { eq, and, desc, sql } = require('drizzle-orm');

// Get all projects for the current user
router.get('/', auth, async (req, res, next) => {
  try {
    console.log('Projects route: Fetching projects for user:', req.user.id);
    
    // Use raw SQL query to match the actual database schema
    const result = await db.execute(sql`
      SELECT 
        id, 
        name, 
        description, 
        location, 
        status, 
        created_at, 
        updated_at
      FROM projects 
      WHERE user_id = ${req.user.id}
      ORDER BY updated_at DESC
    `);
    
    console.log('Projects route: Found projects:', result.rows.length);
    console.log('Projects route: Project statuses:', result.rows.map(p => ({ id: p.id, name: p.name, status: p.status })));
    
    // Format the data for the frontend
    const formattedProjects = result.rows.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      location: project.location,
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      lastUpdated: project.updated_at || project.created_at,
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
    
    const result = await db.execute(sql`
      SELECT * FROM projects 
      WHERE id = ${id} AND user_id = ${req.user.id}
    `);
    
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
      createdAt: project.created_at,
      updatedAt: project.updated_at,
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
    
    const now = new Date();
    
    // Create new project using raw SQL to match database schema
    const result = await db.execute(sql`
      INSERT INTO projects (
        id, 
        user_id, 
        name, 
        description, 
        status, 
        location, 
        created_at, 
        updated_at
      ) VALUES (
        ${uuidv4()}, 
        ${req.user.id}, 
        ${projectData.name}, 
        ${projectData.description || ''}, 
        ${projectData.status || 'active'}, 
        ${projectData.location || ''}, 
        ${now}, 
        ${now}
      ) RETURNING *
    `);
    
    const newProject = result.rows[0];
    console.log('Created project:', newProject); // Debug log
    
    // Return the new project
    res.status(201).json({
      id: newProject.id,
      name: newProject.name,
      description: newProject.description,
      status: newProject.status,
      location: newProject.location,
      createdAt: newProject.created_at,
      updatedAt: newProject.updated_at,
      lastUpdated: newProject.updated_at || newProject.created_at,
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
    const checkResult = await db.execute(sql`
      SELECT * FROM projects 
      WHERE id = ${id} AND user_id = ${req.user.id}
    `);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Update project using raw SQL
    const result = await db.execute(sql`
      UPDATE projects 
      SET 
        name = COALESCE(${updateData.name}, name),
        description = COALESCE(${updateData.description}, description),
        status = COALESCE(${updateData.status}, status),
        location = COALESCE(${updateData.location}, location),
        updated_at = ${new Date()}
      WHERE id = ${id} AND user_id = ${req.user.id}
      RETURNING *
    `);
    
    const updatedProject = result.rows[0];
    
    res.status(200).json({
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      status: updatedProject.status,
      location: updatedProject.location,
      createdAt: updatedProject.created_at,
      updatedAt: updatedProject.updated_at,
      lastUpdated: updatedProject.updated_at,
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
    const checkResult = await db.execute(sql`
      SELECT * FROM projects 
      WHERE id = ${id} AND user_id = ${req.user.id}
    `);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Delete project (panels will be deleted automatically due to CASCADE)
    await db.execute(sql`
      DELETE FROM projects 
      WHERE id = ${id} AND user_id = ${req.user.id}
    `);
    
    res.status(200).json({ message: 'Project and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    next(error);
  }
});

// Get project statistics
router.get('/stats', auth, async (req, res, next) => {
  try {
    // Get counts of projects by status
    const stats = {
      total: 0,
      active: 0,
      completed: 0,
      onHold: 0,
      overdue: 0,
    };
    
    // Get all projects for the user
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, req.user.id));
    
    // Count by status
    stats.total = userProjects.length;
    stats.active = userProjects.filter(p => p.status === 'active').length;
    stats.completed = userProjects.filter(p => p.status === 'completed').length;
    stats.onHold = userProjects.filter(p => p.status === 'on hold').length;
    
    // Get number of overdue tasks
    // This is a placeholder - in a real app, you'd check due dates on tasks
    stats.overdue = 0;
    
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
