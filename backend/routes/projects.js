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
    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        client: projects.client,
        location: projects.location,
        startDate: projects.startDate,
        endDate: projects.endDate,
        area: projects.area,
        progress: projects.progress,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.userId, req.user.id))
      .orderBy(desc(projects.updatedAt));
    
    // Format the data for the frontend
    const formattedProjects = userProjects.map(project => ({
      ...project,
      lastUpdated: project.updatedAt || project.createdAt,
    }));
    
    res.status(200).json(formattedProjects);
  } catch (error) {
    next(error);
  }
});

// Get project by ID
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, id),
        eq(projects.userId, req.user.id)
      ));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.status(200).json(project);
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
    
    // Create new project
    const [newProject] = await db
      .insert(projects)
      .values({
        id: uuidv4(),
        userId: req.user.id,
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status || 'active',
        client: projectData.client,
        location: projectData.location || '',
        startDate: projectData.startDate || null,
        endDate: projectData.endDate || null,
        area: projectData.area || null,
        progress: projectData.progress || 0,
        subscription: req.user.subscription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    
    console.log('Created project:', newProject); // Debug log
    
    // Create an initial empty panel layout
    await db.insert(panels).values({
      id: uuidv4(),
      projectId: newProject.id,
      panels: '[]', // Empty panels array as string
      width: '100',
      height: '100',
      scale: '1',
      lastUpdated: new Date(),
    });
    
    // Return the new project
    res.status(201).json({
      ...newProject,
      lastUpdated: newProject.updatedAt || newProject.createdAt,
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
    const [existingProject] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, id),
        eq(projects.userId, req.user.id)
      ));
    
    if (!existingProject) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Update project
    const [updatedProject] = await db
      .update(projects)
      .set({
        ...updateData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(projects.id, id))
      .returning();
    
    res.status(200).json({
      ...updatedProject,
      lastUpdated: updatedProject.updatedAt,
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
    const [existingProject] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, id),
        eq(projects.userId, req.user.id)
      ));
    
    if (!existingProject) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Delete project (in a real app, consider soft delete or cascading delete)
    await db
      .delete(projects)
      .where(eq(projects.id, id));
    
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
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
