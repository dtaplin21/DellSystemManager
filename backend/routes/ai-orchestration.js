const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const logger = require('../lib/logger');

// In-memory storage for orchestration status (in production, use Redis or database)
const orchestrationStatus = new Map();
const availableWorkflows = [
  'comprehensive',
  'project_setup',
  'document_analysis',
  'panel_optimization',
  'qc_analysis'
];

/**
 * GET /api/ai/orchestration/status/:projectId
 * Get current orchestration status for a project
 */
router.get('/status/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get orchestration status for the project
    const status = orchestrationStatus.get(projectId) || {
      workflowId: null,
      workflowName: null,
      status: 'idle',
      agents: [],
      steps: [],
      currentStep: 0,
      totalSteps: 0
    };

    res.json(status);
  } catch (error) {
    logger.error('Error getting orchestration status:', error);
    res.status(500).json({ error: 'Failed to get orchestration status' });
  }
});

/**
 * POST /api/ai/orchestration/start/:projectId
 * Start a workflow orchestration
 */
router.post('/start/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { workflowType = 'comprehensive' } = req.body;

    logger.debug(`Starting orchestration for project ${projectId} with workflow ${workflowType}`);

    // Create initial orchestration status
    const workflowId = `workflow_${Date.now()}`;
    const status = {
      workflowId,
      workflowName: workflowType.replace('_', ' ').toUpperCase(),
      status: 'running',
      startTime: new Date().toISOString(),
      currentStep: 0,
      totalSteps: 3,
      agents: [
        {
          id: 'config_agent',
          name: 'Project Config Agent',
          role: 'Project Configuration Specialist',
          status: 'working',
          currentTask: 'Configuring project settings...',
          progress: 0,
          lastUpdate: new Date().toISOString()
        },
        {
          id: 'doc_agent',
          name: 'Document Agent',
          role: 'Document Intelligence Analyst',
          status: 'waiting',
          currentTask: 'Waiting for configuration...',
          progress: 0,
          lastUpdate: new Date().toISOString()
        },
        {
          id: 'layout_agent',
          name: 'Layout Agent',
          role: 'Panel Layout Optimizer',
          status: 'waiting',
          currentTask: 'Waiting for document analysis...',
          progress: 0,
          lastUpdate: new Date().toISOString()
        }
      ],
      steps: [
        {
          id: 'step_1',
          name: 'Project Configuration',
          description: 'Configure project settings and optimize workflow',
          agent: 'config_agent',
          status: 'active'
        },
        {
          id: 'step_2',
          name: 'Document Analysis',
          description: 'Analyze project documents and extract key information',
          agent: 'doc_agent',
          status: 'pending'
        },
        {
          id: 'step_3',
          name: 'Layout Optimization',
          description: 'Generate initial panel layout based on project requirements',
          agent: 'layout_agent',
          status: 'pending'
        }
      ]
    };

    // Store the status
    orchestrationStatus.set(projectId, status);

    // Start the actual workflow (this would call your AI service)
    // For now, we'll simulate the workflow progression
    simulateWorkflowProgression(projectId, workflowId);

    res.json({
      success: true,
      workflowId,
      message: 'Workflow orchestration started',
      status
    });

  } catch (error) {
    logger.error('Error starting orchestration:', error);
    res.status(500).json({ error: 'Failed to start orchestration' });
  }
});

/**
 * POST /api/ai/orchestration/stop/:projectId
 * Stop a workflow orchestration
 */
router.post('/stop/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const status = orchestrationStatus.get(projectId);
    if (!status || status.status !== 'running') {
      return res.status(400).json({ error: 'No running workflow to stop' });
    }

    // Update status to stopped
    status.status = 'idle';
    status.endTime = new Date().toISOString();
    
    // Update all agents to idle
    status.agents.forEach(agent => {
      agent.status = 'idle';
      agent.currentTask = 'Workflow stopped';
      agent.progress = 0;
    });

    // Update all steps to pending
    status.steps.forEach(step => {
      if (step.status === 'active') {
        step.status = 'pending';
      }
    });

    orchestrationStatus.set(projectId, status);

    res.json({
      success: true,
      message: 'Workflow orchestration stopped',
      status
    });

  } catch (error) {
    logger.error('Error stopping orchestration:', error);
    res.status(500).json({ error: 'Failed to stop orchestration' });
  }
});

/**
 * GET /api/ai/orchestration/workflows
 * Get available workflow types
 */
router.get('/workflows', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      in_progress: true,
      workflows: availableWorkflows,
      description: 'Available AI workflow types for orchestration'
    });
  } catch (error) {
    logger.error('Error getting available workflows:', error);
    res.status(500).json({ error: 'Failed to get available workflows' });
  }
});

/**
 * GET /api/ai/orchestration/manifest
 * Get the orchestrator manifest
 */
router.get('/manifest', auth, async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    
    const manifestPath = path.join(__dirname, '../../ai_service/orchestrator_manifest.json');
    
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      res.json({
        success: true,
        manifest
      });
    } else {
      res.status(404).json({ error: 'Orchestrator manifest not found' });
    }
  } catch (error) {
    logger.error('Error getting orchestrator manifest:', error);
    res.status(500).json({ error: 'Failed to get orchestrator manifest' });
  }
});

/**
 * Simulate workflow progression (replace with actual AI service calls)
 */
function simulateWorkflowProgression(projectId, workflowId) {
  const status = orchestrationStatus.get(projectId);
  if (!status) return;

  // Step 1: Configuration (0-2 seconds)
  setTimeout(() => {
    updateAgentStatus(projectId, 'config_agent', {
      status: 'completed',
      currentTask: 'Configuration completed',
      progress: 100
    });
    updateStepStatus(projectId, 'step_1', 'completed');
    
    // Move to step 2
    updateAgentStatus(projectId, 'doc_agent', {
      status: 'working',
      currentTask: 'Analyzing documents...',
      progress: 0
    });
    updateStepStatus(projectId, 'step_2', 'active');
    updateCurrentStep(projectId, 1);
  }, 2000);

  // Step 2: Document Analysis (2-5 seconds)
  setTimeout(() => {
    updateAgentStatus(projectId, 'doc_agent', {
      status: 'completed',
      currentTask: 'Document analysis completed',
      progress: 100
    });
    updateStepStatus(projectId, 'step_2', 'completed');
    
    // Move to step 3
    updateAgentStatus(projectId, 'layout_agent', {
      status: 'working',
      currentTask: 'Optimizing panel layout...',
      progress: 0
    });
    updateStepStatus(projectId, 'step_3', 'active');
    updateCurrentStep(projectId, 2);
  }, 5000);

  // Step 3: Layout Optimization (5-8 seconds)
  setTimeout(() => {
    updateAgentStatus(projectId, 'layout_agent', {
      status: 'completed',
      currentTask: 'Layout optimization completed',
      progress: 100
    });
    updateStepStatus(projectId, 'step_3', 'completed');
    
    // Complete workflow
    completeWorkflow(projectId);
  }, 8000);
}

function updateAgentStatus(projectId, agentId, updates) {
  const status = orchestrationStatus.get(projectId);
  if (!status) return;

  const agent = status.agents.find(a => a.id === agentId);
  if (agent) {
    Object.assign(agent, updates, { lastUpdate: new Date().toISOString() });
    orchestrationStatus.set(projectId, status);
  }
}

function updateStepStatus(projectId, stepId, newStatus) {
  const status = orchestrationStatus.get(projectId);
  if (!status) return;

  const step = status.steps.find(s => s.id === stepId);
  if (step) {
    step.status = newStatus;
    if (newStatus === 'active') {
      step.startTime = new Date().toISOString();
    } else if (newStatus === 'completed') {
      step.endTime = new Date().toISOString();
    }
    orchestrationStatus.set(projectId, status);
  }
}

function updateCurrentStep(projectId, stepNumber) {
  const status = orchestrationStatus.get(projectId);
  if (!status) return;

  status.currentStep = stepNumber;
  orchestrationStatus.set(projectId, status);
}

function completeWorkflow(projectId) {
  const status = orchestrationStatus.get(projectId);
  if (!status) return;

  status.status = 'completed';
  status.endTime = new Date().toISOString();
  orchestrationStatus.set(projectId, status);
}

module.exports = router;
