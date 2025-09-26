const express = require('express');
const router = express.Router();
const panelLayoutService = require('../services/panelLayoutService');
const { auth } = require('../middlewares/auth');

// Create a single panel
router.post('/create-panel', auth, async (req, res) => {
  try {
    const { projectId, panelData } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!panelData) {
      return res.status(400).json({ error: 'Panel data is required' });
    }

    const newPanel = await panelLayoutService.createPanel(projectId, panelData);

    res.json({
      success: true,
      panel: newPanel,
      message: 'Panel created successfully'
    });

  } catch (error) {
    console.error('Error creating panel:', error);
    res.status(500).json({
      error: 'Failed to create panel',
      details: error.message
    });
  }
});

// Move a panel to a new position
router.post('/move-panel', auth, async (req, res) => {
  try {
    const { projectId, panelId, newPosition } = req.body;

    if (!projectId || !panelId || !newPosition) {
      return res.status(400).json({ 
        error: 'Project ID, panel ID, and new position are required' 
      });
    }

    const updatedPanel = await panelLayoutService.movePanel(projectId, panelId, newPosition);

    res.json({
      success: true,
      panel: updatedPanel,
      message: 'Panel moved successfully'
    });

  } catch (error) {
    console.error('Error moving panel:', error);
    res.status(500).json({
      error: 'Failed to move panel',
      details: error.message
    });
  }
});

// Delete a panel
router.delete('/delete-panel', auth, async (req, res) => {
  try {
    const { projectId, panelId } = req.body;

    if (!projectId || !panelId) {
      return res.status(400).json({ 
        error: 'Project ID and panel ID are required' 
      });
    }

    const result = await panelLayoutService.deletePanel(projectId, panelId);

    res.json({
      success: true,
      result,
      message: 'Panel deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting panel:', error);
    res.status(500).json({
      error: 'Failed to delete panel',
      details: error.message
    });
  }
});

// Get layout for a project (authenticated)
router.get('/get-layout/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const layout = await panelLayoutService.getLayout(projectId);

    res.json({
      success: true,
      layout,
      message: 'Layout retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting layout:', error);
    res.status(500).json({
      error: 'Failed to get layout',
      details: error.message
    });
  }
});

// Get layout for a project (SSR - no auth required)
router.get('/ssr-layout/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const layout = await panelLayoutService.getLayout(projectId);

    res.json({
      success: true,
      layout,
      message: 'Layout retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting layout for SSR:', error);
    res.status(500).json({
      error: 'Failed to get layout',
      details: error.message
    });
  }
});

// Batch operations (create multiple panels)
router.post('/batch-operations', auth, async (req, res) => {
  try {
    const { projectId, operations } = req.body;

    if (!projectId || !operations || !Array.isArray(operations)) {
      return res.status(400).json({ 
        error: 'Project ID and operations array are required' 
      });
    }

    const results = [];

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'CREATE_PANEL':
            const newPanel = await panelLayoutService.createPanel(projectId, operation.payload);
            results.push({ success: true, type: 'CREATE_PANEL', panel: newPanel });
            break;

          case 'MOVE_PANEL':
            // Validate newPosition before moving
            if (!operation.payload.newPosition || typeof operation.payload.newPosition !== 'object') {
              results.push({ 
                success: false, 
                type: 'MOVE_PANEL', 
                error: 'Invalid newPosition: must be an object' 
              });
              break;
            }
            
            // Validate rotation if present
            if (operation.payload.newPosition.rotation !== undefined) {
              const rotation = operation.payload.newPosition.rotation;
              if (typeof rotation !== 'number' || rotation < 0 || rotation >= 360 || !isFinite(rotation)) {
                results.push({ 
                  success: false, 
                  type: 'MOVE_PANEL', 
                  error: 'Invalid rotation: must be a number between 0 and 360 degrees' 
                });
                break;
              }
            }
            
            const movedPanel = await panelLayoutService.movePanel(
              projectId, 
              operation.payload.panelId, 
              operation.payload.newPosition
            );
            results.push({ success: true, type: 'MOVE_PANEL', panel: movedPanel });
            break;

          case 'DELETE_PANEL':
            const deleteResult = await panelLayoutService.deletePanel(
              projectId, 
              operation.payload.panelId
            );
            results.push({ success: true, type: 'DELETE_PANEL', result: deleteResult });
            break;

          default:
            results.push({ 
              success: false, 
              type: operation.type, 
              error: 'Unknown operation type' 
            });
        }
      } catch (error) {
        results.push({ 
          success: false, 
          type: operation.type, 
          error: error.message 
        });
      }
    }

    res.json({
      success: true,
      results,
      message: 'Batch operations completed'
    });

  } catch (error) {
    console.error('Error in batch operations:', error);
    res.status(500).json({
      error: 'Failed to execute batch operations',
      details: error.message
    });
  }
});

// Optimize layout
router.post('/optimize', auth, async (req, res) => {
  try {
    const { projectId, constraints } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const optimizedPanels = await panelLayoutService.optimizeLayout(projectId, constraints);

    res.json({
      success: true,
      panels: optimizedPanels,
      message: 'Layout optimized successfully'
    });

  } catch (error) {
    console.error('Error optimizing layout:', error);
    res.status(500).json({
      error: 'Failed to optimize layout',
      details: error.message
    });
  }
});

// Execute AI-generated layout actions
router.post('/execute-ai-layout', auth, async (req, res) => {
  try {
    const { projectId, actions } = req.body;

    if (!projectId || !actions || !Array.isArray(actions)) {
      return res.status(400).json({ 
        error: 'Project ID and actions array are required' 
      });
    }

    const results = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'CREATE_PANEL':
            const newPanel = await panelLayoutService.createPanel(projectId, action.payload);
            results.push({ 
              success: true, 
              type: 'CREATE_PANEL', 
              panel: newPanel,
              actionId: action.id 
            });
            break;

          case 'MOVE_PANEL':
            // Validate newPosition before moving
            if (!action.payload.newPosition || typeof action.payload.newPosition !== 'object') {
              results.push({ 
                success: false, 
                type: 'MOVE_PANEL', 
                error: 'Invalid newPosition: must be an object',
                actionId: action.id 
              });
              break;
            }
            
            // Validate rotation if present
            if (action.payload.newPosition.rotation !== undefined) {
              const rotation = action.payload.newPosition.rotation;
              if (typeof rotation !== 'number' || rotation < 0 || rotation >= 360 || !isFinite(rotation)) {
                results.push({ 
                  success: false, 
                  type: 'MOVE_PANEL', 
                  error: 'Invalid rotation: must be a number between 0 and 360 degrees',
                  actionId: action.id 
                });
                break;
              }
            }
            
            const movedPanel = await panelLayoutService.movePanel(
              projectId, 
              action.payload.panelId, 
              action.payload.newPosition
            );
            results.push({ 
              success: true, 
              type: 'MOVE_PANEL', 
              panel: movedPanel,
              actionId: action.id 
            });
            break;

          case 'DELETE_PANEL':
            const deleteResult = await panelLayoutService.deletePanel(
              projectId, 
              action.payload.panelId
            );
            results.push({ 
              success: true, 
              type: 'DELETE_PANEL', 
              result: deleteResult,
              actionId: action.id 
            });
            break;

          default:
            results.push({ 
              success: false, 
              type: action.type, 
              error: 'Unknown action type',
              actionId: action.id 
            });
        }
      } catch (error) {
        results.push({ 
          success: false, 
          type: action.type, 
          error: error.message,
          actionId: action.id 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    res.json({
      success: true,
      results,
      summary: {
        totalActions: totalCount,
        successfulActions: successCount,
        failedActions: totalCount - successCount,
        successRate: (successCount / totalCount) * 100
      },
      message: `Executed ${successCount}/${totalCount} AI layout actions successfully`
    });

  } catch (error) {
    console.error('Error executing AI layout:', error);
    res.status(500).json({
      error: 'Failed to execute AI layout',
      details: error.message
    });
  }
});

module.exports = router; 