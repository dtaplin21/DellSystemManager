const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const config = require('../config/env');
const logger = require('../lib/logger');
const panelLayoutService = require('../services/panelLayoutService');
const { auth } = require('../middlewares/auth');

// Python AI Service configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:5001';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.secrets.openai || process.env.OPENAI_API_KEY,
});

if (!config.secrets.openai && !process.env.OPENAI_API_KEY) {
  logger.warn('OpenAI API key is not configured. AI endpoints will be limited.');
}

// In-memory storage for job status (in production, use Redis or database)
const jobStatus = new Map();

const sanitizePanel = (panel) => ({
  id: panel.id,
  panelNumber: panel.panelNumber || panel.panel_number || '',
  rollNumber: panel.rollNumber || panel.roll_number || '',
  width: Number(panel.width ?? panel.width_feet ?? 0),
  height: Number(panel.height ?? panel.height_feet ?? 0),
  x: Number(panel.x ?? 0),
  y: Number(panel.y ?? 0),
  rotation: Number(panel.rotation ?? 0),
  shape: panel.shape || panel.type || 'rectangle',
  material: panel.material || null,
  thickness: panel.thickness || null,
  color: panel.color || panel.fill || '#87CEEB',
  fill: panel.fill || panel.color || '#87CEEB'
});

const sanitizePanels = (panels = []) => panels.map(sanitizePanel);

const getLastUserMessage = (message, messages = []) => {
  if (message && typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  if (Array.isArray(messages) && messages.length > 0) {
    const lastMessage = [...messages].reverse().find(m => m?.role === 'user' && m.content);
    if (lastMessage?.content) {
      return String(lastMessage.content).trim();
    }
  }

  return '';
};

const findPanelByIdentifier = (panels = [], identifier, projectId) => {
  if (!identifier || !panels.length) return null;

  const normalized = identifier.toString().trim().toLowerCase();
  const cleaned = normalized.replace(/^panel\s+/, '').replace(/^#/, '');

  return panels.find(panel => {
    if (!panel) return false;

    const candidates = [
      panel.id,
      panel.panelNumber || panel.panel_number,
      panel.rollNumber || panel.roll_number,
      `panel-${projectId}-${panel.x}-${panel.y}-${panel.width}-${panel.height}`
    ].filter(Boolean).map(value => value.toString().trim().toLowerCase());

    return candidates.includes(cleaned);
  }) || null;
};

const getPreferredPanelIdentifier = (panel) => {
  if (!panel) return null;
  return panel.id || panel.panelNumber || panel.panel_number || panel.rollNumber || panel.roll_number || null;
};

const parseDimensionsFromText = (text) => {
  if (!text) return null;

  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')?\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (isNaN(width) || isNaN(height)) return null;

  return { width, height };
};

const parseCoordinatesFromText = (text) => {
  if (!text) return null;

  const normalized = text.replace(/\s+/g, ' ');
  const coordinateMatch = normalized.match(/(?:to|at)\s*(?:coordinates\s*)?(?:x\s*=?\s*)?(-?\d+(?:\.\d+)?)[,\s]+(?:y\s*=?\s*)?(-?\d+(?:\.\d+)?)/i);

  if (coordinateMatch) {
    const x = Number(coordinateMatch[1]);
    const y = Number(coordinateMatch[2]);
    if (!isNaN(x) && !isNaN(y)) {
      return { x, y };
    }
  }

  const simpleMatch = normalized.match(/(?:to|at)\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (simpleMatch) {
    const x = Number(simpleMatch[1]);
    const y = Number(simpleMatch[2]);
    if (!isNaN(x) && !isNaN(y)) {
      return { x, y };
    }
  }

  return null;
};

const parseRotationFromText = (text) => {
  if (!text) return null;

  const match = text.match(/(?:rotate|rotation|angle)\s*(?:by)?\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const rotation = Number(match[1]);
  if (isNaN(rotation)) return null;

  return rotation % 360;
};

const deriveDirectionalPosition = (direction, layout) => {
  if (!direction || !layout) return null;

  const norm = direction.toLowerCase();
  const padding = 50;
  const { width = 1000, height = 800 } = layout;

  switch (true) {
    case /\b(center|middle)\b/.test(norm):
      return { x: width / 2, y: height / 2 };
    case /\bnorth\b/.test(norm):
      return { x: width / 2, y: padding };
    case /\bsouth\b/.test(norm):
      return { x: width / 2, y: height - padding };
    case /\beast|right\b/.test(norm):
      return { x: width - padding, y: height / 2 };
    case /\bwest|left\b/.test(norm):
      return { x: padding, y: height / 2 };
    case /\bupper left\b/.test(norm):
      return { x: padding, y: padding };
    case /\bupper right\b/.test(norm):
      return { x: width - padding, y: padding };
    case /\blower left\b/.test(norm):
      return { x: padding, y: height - padding };
    case /\blower right\b/.test(norm):
      return { x: width - padding, y: height - padding };
    default:
      return null;
  }
};

const composePanelSummary = (panels = [], userMessage = '') => {
  if (!panels.length) {
    return 'There are no panels in this layout yet. You can ask me to create one, import from Excel, or run the AI optimizer.';
  }

  const count = panels.length;
  const normalizedMessage = (userMessage || '').toLowerCase();
  
  // Check if user explicitly asked for "all" panels or dimensions
  const requestAll = normalizedMessage.includes('all') || normalizedMessage.includes('complete') || normalizedMessage.includes('full');
  
  // If user asks for "all", show all panels. Otherwise show summary.
  const panelsToShow = requestAll ? panels : panels.slice(0, 50); // Show up to 50 in summary mode
  const displayPanels = panelsToShow.map(panel => {
    const { panelNumber, rollNumber, width, height, x, y } = sanitizePanel(panel);
    return `${panelNumber || panel.id || 'Panel'} (${width}ft x ${height}ft) at (${x}, ${y})${rollNumber ? `, roll ${rollNumber}` : ''}`;
  });

  const summaryParts = [
    `I currently track ${count} panel${count === 1 ? '' : 's'}.`
  ];
  
  if (requestAll) {
    summaryParts.push('All panels:', ...displayPanels.map(entry => `• ${entry}`));
  } else if (panels.length <= 50) {
    summaryParts.push('Panels:', ...displayPanels.map(entry => `• ${entry}`));
  } else {
    summaryParts.push(
      'Showing first 50 panels:',
      ...displayPanels.map(entry => `• ${entry}`),
      `\n…and ${count - 50} more. Use "show all panels" to see the complete list.`
    );
  }

  return summaryParts.join('\n');
};

const buildContextualSuggestions = (context = {}) => {
  const baseSuggestions = [
    'Create a new 40ft x 100ft panel near the north edge.',
    'List all panels with their positions.',
    'Move panel P1 to coordinates 250, 180.'
  ];

  if (context.lastAction === 'create' && context.panelNumber) {
    return [
      `Move panel ${context.panelNumber} to the correct position.`,
      `Rotate panel ${context.panelNumber} by 5 degrees.`,
      'Show me a summary of all panels again.'
    ];
  }

  if (context.lastAction === 'move' && context.panelNumber) {
    return [
      `Resize panel ${context.panelNumber} to match field measurements.`,
      `Rotate panel ${context.panelNumber} by 15 degrees.`,
      'Optimize the overall layout for better spacing.'
    ];
  }

  if (context.lastAction === 'resize' && context.panelNumber) {
    return [
      `Move panel ${context.panelNumber} to its installation location.`,
      'List panels that might overlap after this resize.',
      'Generate a compliance check summary for panel dimensions.'
    ];
  }

  return baseSuggestions;
};

const hasLLMSupport = Boolean(config.secrets.openai || process.env.OPENAI_API_KEY);

const buildPanelContextForLLM = (panels = [], userMessage = '') => {
  if (!panels.length) {
    return 'No panels currently exist in this layout.';
  }

  const normalizedMessage = (userMessage || '').toLowerCase();
  
  // Check if user explicitly asked for "all" panels or dimensions
  const requestAll = normalizedMessage.includes('all') || normalizedMessage.includes('complete') || normalizedMessage.includes('full');
  
  // If user asks for "all", show all panels. Otherwise limit to 50 for context efficiency.
  const panelsToShow = requestAll ? panels : panels.slice(0, 50);
  
  const displayPanels = panelsToShow.map((panel, index) => {
    const sanitized = sanitizePanel(panel);
    return `${index + 1}. Panel ${sanitized.panelNumber || sanitized.id} — ${sanitized.width}ft x ${sanitized.height}ft at (${sanitized.x}, ${sanitized.y}) rotation ${sanitized.rotation}°, shape ${sanitized.shape}.`;
  });

  if (!requestAll && panels.length > 50) {
    displayPanels.push(`…and ${panels.length - 50} additional panels not shown.`);
  }

  return displayPanels.join('\n');
};

const generateLLMFallback = async (userMessage, layout, projectContext = {}) => {
  if (!hasLLMSupport) {
    return "I didn't recognize a panel layout command. Try asking me to create, move, resize, delete a panel, or request a layout summary.";
  }

  try {
    const systemPrompt = `You are an assistant that helps manage geosynthetic panel layouts. Keep responses concise. When giving instructions, keep them actionable.`;
    const panelSummary = buildPanelContextForLLM(layout?.panels || [], userMessage);

    const prompt = `Project info: ${JSON.stringify(projectContext || {}, null, 2)}

Current panels:
${panelSummary}

User request: ${userMessage}

If the request does not map to a direct layout command, provide a helpful response or next steps.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.4
    });

    return response?.choices?.[0]?.message?.content?.trim() ||
      "I'm here to help with panel layout commands such as creating, moving, resizing, or summarizing panels.";
  } catch (error) {
    logger.error('LLM fallback failed', {
      error: error?.message,
      stack: config.isDevelopment ? error?.stack : undefined
    });
    return "I'm ready to help with panel layout commands such as creating, moving, resizing, or summarizing panels.";
  }
};

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  // For now, we'll skip auth check for development
  // In production, implement proper JWT verification
  next();
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    openaiConfigured: Boolean(config.secrets.openai || process.env.OPENAI_API_KEY) 
  });
});

router.post('/chat', auth, async (req, res) => {
  const startedAt = Date.now();

  try {
    const { projectId, message, messages = [], context = {} } = req.body || {};

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required',
        reply: 'I need to know which project to work with. Please provide a project ID.',
        suggestions: buildContextualSuggestions()
      });
    }

    const userMessage = getLastUserMessage(message, messages);
    if (!userMessage) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        reply: 'Tell me what you would like me to do with the panel layout.',
        suggestions: buildContextualSuggestions()
      });
    }

    logger.debug('[AI CHAT] Processing message', {
      projectId,
      userId: req.user?.id,
      message: userMessage
    });

    // Try Python AI Service first (for tool-based execution)
    const usePythonService = process.env.USE_PYTHON_AI_SERVICE !== 'false'; // Default to true
    if (usePythonService) {
      try {
        logger.info('[AI CHAT] Attempting to use Python AI service', { 
          aiServiceUrl: AI_SERVICE_URL,
          projectId,
          messageLength: userMessage.length 
        });
        
        // Build frontend URL for panel layout
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const panelLayoutUrl = `${frontendBaseUrl}/dashboard/projects/${projectId}/panel-layout`;
        
        const pythonResponse = await axios.post(
          `${AI_SERVICE_URL}/api/ai/chat`,
          {
            projectId,
            user_id: req.user?.id || 'anonymous',
            user_tier: req.user?.tier || 'paid_user',
            message: userMessage,
            context: {
              ...context,
              projectId,
              projectInfo: context.projectInfo || context.project || {},
              panelLayoutUrl: panelLayoutUrl,
              panel_layout_url: panelLayoutUrl, // Support both naming conventions
              frontendUrl: frontendBaseUrl,
              frontend_url: frontendBaseUrl
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(req.headers['x-dev-bypass'] && { 'x-dev-bypass': req.headers['x-dev-bypass'] })
            },
            timeout: 120000 // 120 second timeout for AI operations (increased to accommodate browser automation: navigation + selector wait + screenshot + extraction)
          }
        );

        // Check if Python service responded (even with errors, we want to see the error message)
        if (pythonResponse.data) {
          if (pythonResponse.data.success) {
            logger.info('[AI CHAT] Python AI service responded successfully', {
              responseLength: pythonResponse.data.response?.length || 0
            });
            
            // Format response for frontend compatibility
            return res.json({
              success: true,
              reply: pythonResponse.data.response || pythonResponse.data.reply || pythonResponse.data.result,
              actions: pythonResponse.data.actions || [],
              panels: pythonResponse.data.panels || [],
              suggestions: buildContextualSuggestions(pythonResponse.data.actionContext || {}),
              meta: {
                handled: true,
                durationMs: Date.now() - startedAt,
                source: 'python_ai_service',
                panelCount: pythonResponse.data.panels?.length || 0
              }
            });
          } else {
            // Python service returned an error - log it but still fall back
            logger.error('[AI CHAT] Python AI service returned error response', {
              error: pythonResponse.data.error,
              status: pythonResponse.status,
              details: pythonResponse.data
            });
            // Continue to backend fallback below
          }
        }
      } catch (pythonError) {
        // If Python service is unavailable or errors, fall back to backend route
        if (pythonError.code === 'ECONNREFUSED' || pythonError.code === 'ETIMEDOUT') {
          logger.warn('[AI CHAT] Python AI service unavailable, falling back to backend route', {
            error: pythonError.message,
            aiServiceUrl: AI_SERVICE_URL
          });
        } else {
          // Check if Python service returned a response with error details
          if (pythonError.response && pythonError.response.data) {
            const errorData = pythonError.response.data;
            logger.error('[AI CHAT] Python AI service returned error, falling back to backend route', {
              error: errorData.error || pythonError.message,
              status: pythonError.response.status,
              success: errorData.success,
              details: errorData
            });
          } else {
            logger.error('[AI CHAT] Python AI service error, falling back to backend route', {
              error: pythonError.message,
              status: pythonError.response?.status,
              code: pythonError.code
            });
          }
        }
        // Continue to backend route handling below
      }
    }

    const layout = await panelLayoutService.getLayout(projectId);
    let updatedPanels = layout?.panels || [];
    const normalizedMessage = userMessage.toLowerCase();
    let handled = false;
    let reply = '';
    const actions = [];
    let actionContext = {};

    // SUMMARY
    if (!handled && /(list|show|summary|summarise|summarize|overview|describe|status)/.test(normalizedMessage) && /panel|layout/.test(normalizedMessage)) {
      reply = composePanelSummary(updatedPanels, userMessage);
      handled = true;
      actionContext = { lastAction: 'summary' };
    }

    // OPTIMIZE LAYOUT
    if (!handled && /(optimi[sz]e|balance|arrange|organize)/.test(normalizedMessage) && /layout|panel/.test(normalizedMessage)) {
      const strategyMatch = normalizedMessage.match(/material|labor|grid|balanced/);
      const strategy = strategyMatch ? strategyMatch[0].trim() : 'balanced';

      const optimizedPanels = await panelLayoutService.optimizeLayout(projectId, { strategy });
      updatedPanels = optimizedPanels;
      handled = true;
      actionContext = { lastAction: 'optimize' };

      reply = `Applied a ${strategy} optimization across ${optimizedPanels.length} panel${optimizedPanels.length === 1 ? '' : 's'}.`;
      actions.push({
        type: 'OPTIMIZE_LAYOUT',
        description: `Layout optimization (${strategy})`,
        timestamp: new Date().toISOString()
      });
    }

    // CREATE PANEL
    if (!handled && /(create|add)\s+(?:a\s+)?(?:new\s+)?panel/.test(normalizedMessage)) {
      const dimensions = parseDimensionsFromText(userMessage);
      const coordinates = parseCoordinatesFromText(userMessage);
      let shape = 'rectangle';

      if (/triangle/.test(normalizedMessage)) {
        shape = 'right-triangle';
      } else if (/patch|circle|round/.test(normalizedMessage)) {
        shape = 'patch';
      }

      const panelPayload = { shape };
      if (dimensions) {
        panelPayload.width = dimensions.width;
        panelPayload.height = dimensions.height;
      }
      if (coordinates) {
        panelPayload.position = coordinates;
      }

      const newPanel = await panelLayoutService.createPanel(projectId, panelPayload);
      updatedPanels = (await panelLayoutService.getLayout(projectId)).panels;
      handled = true;
      const panelIdentifier = newPanel.panelNumber || newPanel.id;
      actionContext = { lastAction: 'create', panelNumber: panelIdentifier };

      reply = `Created panel ${panelIdentifier} measuring ${newPanel.width}ft x ${newPanel.height}ft.`;
      if (coordinates) {
        reply += ` Positioned at (${newPanel.x}, ${newPanel.y}).`;
      } else {
        reply += ' Provide coordinates or a direction if you need it moved.';
      }

      actions.push({
        type: 'CREATE_PANEL',
        panelId: newPanel.id,
        panelNumber: newPanel.panelNumber,
        description: `Created ${shape} panel ${panelIdentifier}`,
        timestamp: new Date().toISOString()
      });
    }

    // MOVE PANEL
    if (!handled && /(move|relocate|position|place|shift)/.test(normalizedMessage) && /panel/.test(normalizedMessage)) {
      const panelMatch = userMessage.match(/panel\s+([a-z0-9\-]+)/i) || userMessage.match(/\b(p\d+[a-z]?|r\d+[a-z]?|[0-9a-f\-]{8,})\b/i);
      const identifier = panelMatch ? panelMatch[1] : null;

      if (!identifier) {
        reply = 'Please specify which panel to move, for example "Move panel P1 to x=250, y=120".';
        handled = true;
      } else {
        const panel = findPanelByIdentifier(updatedPanels, identifier, projectId);
        if (!panel) {
          reply = `I could not find panel ${identifier}. Try listing panels to confirm the identifier.`;
          handled = true;
        } else {
          let newPosition = parseCoordinatesFromText(userMessage);
          if (!newPosition) {
            newPosition = deriveDirectionalPosition(userMessage, layout);
          }

          if (!newPosition) {
            reply = `I need coordinates or a direction to move panel ${panel.panelNumber || panel.id}. For example, "Move panel ${panel.panelNumber || panel.id} to 200, 150".`;
            handled = true;
          } else {
            const movedPanel = await panelLayoutService.movePanel(projectId, getPreferredPanelIdentifier(panel), {
              x: newPosition.x,
              y: newPosition.y
            });
            updatedPanels = (await panelLayoutService.getLayout(projectId)).panels;
            handled = true;
            const panelIdentifier = movedPanel.panelNumber || movedPanel.id;
            actionContext = { lastAction: 'move', panelNumber: panelIdentifier };

            reply = `Moved panel ${panelIdentifier} to (${movedPanel.x}, ${movedPanel.y}).`;
            actions.push({
              type: 'MOVE_PANEL',
              panelId: movedPanel.id,
              panelNumber: movedPanel.panelNumber,
              description: `Moved panel to (${movedPanel.x}, ${movedPanel.y})`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    // RESIZE PANEL
    if (!handled && /(resize|rescale|adjust size|change size|make (?:bigger|smaller))/i.test(normalizedMessage)) {
      const panelMatch = userMessage.match(/panel\s+([a-z0-9\-]+)/i) || userMessage.match(/\b(p\d+[a-z]?|[0-9a-f\-]{8,})\b/i);
      const identifier = panelMatch ? panelMatch[1] : null;

      if (!identifier) {
        reply = 'Please specify which panel to resize, for example "Resize panel P1 to 45ft x 95ft".';
        handled = true;
      } else {
        const panel = findPanelByIdentifier(updatedPanels, identifier, projectId);
        if (!panel) {
          reply = `I could not find panel ${identifier}. Try asking for a panel summary first.`;
          handled = true;
        } else {
          const dimensions = parseDimensionsFromText(userMessage);
          let width = dimensions?.width;
          let height = dimensions?.height;

          if (!dimensions) {
            if (/bigger|increase|larger/.test(normalizedMessage)) {
              width = Number(panel.width) * 1.1;
              height = Number(panel.height) * 1.1;
            } else if (/smaller|decrease|shrink/.test(normalizedMessage)) {
              width = Number(panel.width) * 0.9;
              height = Number(panel.height) * 0.9;
            }
          }

          if (!width || !height) {
            reply = `I need new dimensions to resize panel ${panel.panelNumber || panel.id}. Try "Resize panel ${panel.panelNumber || panel.id} to 45ft x 95ft".`;
            handled = true;
          } else {
            const resizedPanel = await panelLayoutService.updatePanelProperties(projectId, getPreferredPanelIdentifier(panel), {
              width,
              height
            });
            updatedPanels = (await panelLayoutService.getLayout(projectId)).panels;
            handled = true;
            const panelIdentifier = resizedPanel.panelNumber || resizedPanel.id;
            actionContext = { lastAction: 'resize', panelNumber: panelIdentifier };

            reply = `Updated panel ${panelIdentifier} to ${resizedPanel.width.toFixed(1)}ft x ${resizedPanel.height.toFixed(1)}ft.`;
            actions.push({
              type: 'RESIZE_PANEL',
              panelId: resizedPanel.id,
              panelNumber: resizedPanel.panelNumber,
              description: `Resized panel to ${resizedPanel.width.toFixed(1)}ft x ${resizedPanel.height.toFixed(1)}ft`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    // ROTATE PANEL
    if (!handled && /(rotate|rotation|angle)/.test(normalizedMessage) && /panel/.test(normalizedMessage)) {
      const panelMatch = userMessage.match(/panel\s+([a-z0-9\-]+)/i) || userMessage.match(/\b(p\d+[a-z]?|[0-9a-f\-]{8,})\b/i);
      const identifier = panelMatch ? panelMatch[1] : null;

      if (!identifier) {
        reply = 'Please specify which panel to rotate, for example "Rotate panel P1 by 15 degrees".';
        handled = true;
      } else {
        const panel = findPanelByIdentifier(updatedPanels, identifier, projectId);
        if (!panel) {
          reply = `I could not find panel ${identifier}.`;
          handled = true;
        } else {
          const rotation = parseRotationFromText(userMessage);
          if (rotation === null) {
            reply = `Tell me the rotation angle, for example "Rotate panel ${panel.panelNumber || panel.id} by 15 degrees".`;
            handled = true;
          } else {
            const rotatedPanel = await panelLayoutService.updatePanelProperties(projectId, getPreferredPanelIdentifier(panel), { rotation });
            updatedPanels = (await panelLayoutService.getLayout(projectId)).panels;
            handled = true;
            const panelIdentifier = rotatedPanel.panelNumber || rotatedPanel.id;
            actionContext = { lastAction: 'rotate', panelNumber: panelIdentifier };

            reply = `Set panel ${panelIdentifier} rotation to ${rotatedPanel.rotation}°.`;
            actions.push({
              type: 'ROTATE_PANEL',
              panelId: rotatedPanel.id,
              panelNumber: rotatedPanel.panelNumber,
              description: `Rotated panel to ${rotatedPanel.rotation}°`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    // DELETE PANEL
    if (!handled && /(delete|remove|discard)/.test(normalizedMessage) && /panel/.test(normalizedMessage)) {
      const panelMatch = userMessage.match(/panel\s+([a-z0-9\-]+)/i) || userMessage.match(/\b(p\d+[a-z]?|[0-9a-f\-]{8,})\b/i);
      const identifier = panelMatch ? panelMatch[1] : null;

      if (!identifier) {
        reply = 'Please specify which panel to remove, for example "Delete panel P3".';
        handled = true;
      } else {
        const panel = findPanelByIdentifier(updatedPanels, identifier, projectId);
        if (!panel) {
          reply = `I could not find panel ${identifier}.`;
          handled = true;
        } else {
          await panelLayoutService.deletePanel(projectId, panel.id);
          updatedPanels = (await panelLayoutService.getLayout(projectId)).panels;
          handled = true;
          actionContext = { lastAction: 'delete' };

          reply = `Removed panel ${panel.panelNumber || panel.id} from the layout.`;
          actions.push({
            type: 'DELETE_PANEL',
            panelId: panel.id,
            panelNumber: panel.panelNumber,
            description: `Deleted panel ${panel.panelNumber || panel.id}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // REORDER PANELS NUMERICALLY
    if (!handled && /(reorder|arrange|sort|organize).*numerical|numerical.*order|put.*numerical/i.test(normalizedMessage)) {
      logger.info('[AI CHAT] Reordering panels numerically', { projectId, panelCount: updatedPanels.length });
      
      try {
        // Sort panels by panelNumber numerically
        const sortedPanels = [...updatedPanels].sort((a, b) => {
          // Extract numeric part from panelNumber (e.g., "P022" -> 22)
          const getNumericValue = (panel) => {
            const panelNum = panel.panelNumber || panel.panel_number || panel.id || '';
            const match = panelNum.toString().match(/\d+/);
            return match ? parseInt(match[0], 10) : Infinity;
          };
          return getNumericValue(a) - getNumericValue(b);
        });

        // Calculate new positions maintaining horizontal formation
        const spacing = 32; // 22ft panel + 10ft gap
        const startX = 50;
        const startY = 50;
        const operations = [];

        for (let i = 0; i < sortedPanels.length; i++) {
          const panel = sortedPanels[i];
          const newX = startX + (i * spacing);
          const newY = startY;

          operations.push({
            type: 'MOVE_PANEL',
            payload: {
              panelId: panel.id,
              newPosition: {
                x: newX,
                y: newY,
                rotation: panel.rotation || 0
              }
            }
          });
        }

        // Execute batch move operations
        if (operations.length > 0) {
          // Use the batch-operations endpoint logic
          const batchResults = [];
          for (const operation of operations) {
            try {
              const movedPanel = await panelLayoutService.movePanel(
                projectId,
                operation.payload.panelId,
                operation.payload.newPosition
              );
              batchResults.push({ success: true, panelId: operation.payload.panelId });
            } catch (error) {
              logger.error('[AI CHAT] Failed to move panel in batch', {
                panelId: operation.payload.panelId,
                error: error.message
              });
              batchResults.push({ success: false, panelId: operation.payload.panelId, error: error.message });
            }
          }
          
          updatedPanels = (await panelLayoutService.getLayout(projectId)).panels;
          handled = true;
          actionContext = { lastAction: 'reorder', panelCount: operations.length };

          reply = `Successfully reordered ${operations.length} panels numerically. Panels are now arranged in order: ${sortedPanels.map(p => p.panelNumber || p.id).join(', ')}.`;

          actions.push({
            type: 'REORDER_PANELS',
            description: `Reordered ${operations.length} panels numerically`,
            timestamp: new Date().toISOString(),
            panelCount: operations.length
          });
        } else {
          reply = 'No panels found to reorder.';
          handled = true;
        }
      } catch (error) {
        logger.error('[AI CHAT] Failed to reorder panels', { error: error.message, stack: error.stack });
        reply = `I encountered an error while reordering panels: ${error.message}. Please try again.`;
        handled = true;
      }
    }

    // HELP
    if (!handled && /(help|capabilities|what can you do)/.test(normalizedMessage)) {
      reply = 'I can create, move, resize, rotate, delete panels, summarize the layout, and optimize panel positions. Try commands like "Create a new panel 40ft x 100ft", "Move panel P1 to 200, 150", or "Optimize panel layout".';
      handled = true;
      actionContext = { lastAction: 'help' };
    }

    if (!handled) {
      reply = await generateLLMFallback(userMessage, layout, context?.projectInfo || context?.project || {});
      actionContext = { lastAction: 'fallback' };
    }

    const durationMs = Date.now() - startedAt;

    res.json({
      success: true,
      reply,
      actions,
      panels: sanitizePanels(updatedPanels),
      suggestions: buildContextualSuggestions(actionContext),
      meta: {
        handled,
        durationMs,
        panelCount: updatedPanels.length
      }
    });
  } catch (error) {
    logger.error('[AI CHAT] Failed to process message', {
      error: {
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process AI chat request',
      reply: 'I ran into an error while processing that request. Please try again.',
      suggestions: buildContextualSuggestions()
    });
  }
});

// Query endpoint for chat functionality
router.post('/query', requireAuth, async (req, res) => {
  try {
    const { projectId, question, documents } = req.body;

    logger.debug('AI query invoked', {
      projectId,
      hasQuestion: Boolean(question),
      documentCount: Array.isArray(documents) ? documents.length : 0
    });

    if (!question) {
      logger.warn('AI query missing question payload');
      return res.status(400).json({ error: 'Question is required' });
    }

    let context = '';
    const references = [];
    const maxTokens = 25000; // Leave room for response tokens
    let currentTokens = 0;

    if (Array.isArray(documents) && documents.length > 0) {
      documents.forEach((doc) => {
        if (!doc?.text) {
          logger.debug('AI query document missing text content', {
            filename: doc?.filename,
            id: doc?.id
          });
          return;
        }

        const estimatedTokens = Math.ceil(doc.text.length / 4);
        let documentText = doc.text;

        if (currentTokens + estimatedTokens > maxTokens) {
          const maxChars = (maxTokens - currentTokens) * 4;
          documentText = doc.text.substring(0, Math.max(maxChars, 0));
        }

        if (!documentText) {
          return;
        }

        context += `Document: ${doc.filename}\nContent: ${documentText}\n\n`;
        currentTokens += Math.ceil(documentText.length / 4);

        const words = documentText.split(' ');
        if (words.length > 20) {
          references.push({
            docId: doc.id,
            page: 1,
            excerpt: words.slice(0, 20).join(' ') + '...'
          });
        }
      });
    } else {
      logger.debug('AI query invoked without documents');
    }

    logger.debug('AI query context prepared', {
      contextCharacters: context.length,
      estimatedTokens: currentTokens
    });

    const prompt = `Based on the following project documents and context, please answer the user's question.

Project ID: ${projectId}

Documents Context:
${context}

User Question: ${question}

Please provide a comprehensive answer based on the available information. If you need to reference specific documents, be specific about which document you're referencing.`;

    logger.debug('Calling OpenAI chat completions', { promptLength: prompt.length });

    let response;
    try {
      response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an AI panel generation system specialized in geosynthetic engineering and quality control. Provide detailed, technical answers based on the provided documents and context."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });
    } catch (openaiError) {
      logger.error('OpenAI API error', {
        message: openaiError.message
      });

      if (openaiError.message && (openaiError.message.includes('429') || openaiError.message.includes('too large'))) {
        logger.debug('Token limit exceeded for AI query, retrying with reduced context');

        const summarizedDocuments = Array.isArray(documents)
          ? documents.map((doc, index) => `Document ${index + 1}: ${doc.filename} (${doc.text ? doc.text.length : 0} characters)`).join('\n')
          : 'No documents provided.';

        const simplifiedPrompt = `Based on the following document summaries, please answer the user's question.

User Question: ${question}

Document Summaries:
${summarizedDocuments}

Please provide a general answer based on the available information. If you need specific details from the documents, please ask the user to provide more specific questions about particular documents.`;

        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an AI panel generation system specialized in geosynthetic engineering and quality control. Provide helpful answers based on available information."
            },
            {
              role: "user",
              content: simplifiedPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        });
      } else {
        throw openaiError;
      }
    }

    const answer = response?.choices?.[0]?.message?.content || '';

    logger.debug('AI query completed', {
      tokensUsed: response?.usage?.total_tokens || 0,
      referencesReturned: references.length
    });

    res.json({
      answer,
      references: references.slice(0, 3),
      tokensUsed: response?.usage?.total_tokens || 0
    });

  } catch (error) {
    logger.error('Error in AI query', {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
    res.status(500).json({ 
      error: 'Failed to process AI query',
      details: error.message 
    });
  }
});

// Document analysis endpoint
router.post('/analyze-documents', requireAuth, async (req, res) => {
  try {
    const { documents, analysisType = 'general' } = req.body;

    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'Documents are required' });
    }

    // Prepare document content for analysis
    let documentContent = '';
    documents.forEach(doc => {
      if (doc.text) {
        documentContent += `Document: ${doc.filename}\n${doc.text}\n\n`;
      }
    });

    const analysisPrompts = {
      general: "Analyze these geosynthetic engineering documents and provide key insights, important specifications, and any quality control requirements mentioned.",
      qc: "Focus on quality control requirements, testing procedures, and compliance standards mentioned in these documents.",
      specifications: "Extract technical specifications, material properties, and design requirements from these documents.",
      layout: "Identify site dimensions, panel requirements, installation guidelines, and any layout-specific information from these documents."
    };

    const prompt = `${analysisPrompts[analysisType] || analysisPrompts.general}

Documents to analyze:
${documentContent}

Please provide a structured analysis in JSON format with the following sections:
- summary: Overall summary of the documents
- key_findings: Important findings and insights
- specifications: Technical specifications found
- recommendations: Recommendations based on the analysis
- qc_requirements: Quality control requirements identified`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert in geosynthetic engineering and quality control. Analyze documents and provide structured insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    res.json({
      analysis,
      documentsAnalyzed: documents.length,
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (error) {
    logger.error('Error in document analysis', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ 
      error: 'Failed to analyze documents',
      details: error.message 
    });
  }
});

// Enhanced AI layout generation endpoint with panel requirements system
router.post('/automate-layout', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    logger.debug(`[AI ROUTE] Starting panel requirements-based layout generation for project ${projectId}`);

    // Set job status to processing
    jobStatus.set(projectId, {
      status: 'processing',
      created_at: new Date().toISOString(),
      completed_at: null
    });

    // Import the enhanced AI layout generator
    const enhancedAILayoutGenerator = require('../services/enhancedAILayoutGenerator');

    // Generate AI layout actions using panel requirements
    const result = await enhancedAILayoutGenerator.generateLayoutActions(projectId);

    logger.debug(`[AI ROUTE] Panel requirements-based generation result status: ${result.status}`);

    // Handle different response statuses
    if (result.status === 'insufficient_information') {
      logger.debug('[AI ROUTE] Insufficient information - returning guidance');
      
      // Update job status with guidance
      jobStatus.set(projectId, {
        status: 'insufficient_information',
        created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        guidance: result.guidance,
        missingParameters: result.missingParameters,
        analysis: result.analysis,
        confidence: result.confidence
      });

      res.json({
        success: true,
        status: 'insufficient_information',
        message: result.guidance.title,
        guidance: result.guidance,
        missingParameters: result.missingParameters,
        analysis: result.analysis,
        confidence: result.confidence,
        jobId: projectId
      });
      return;
    }

    if (!result.success) {
      logger.warn('[AI ROUTE] Panel requirements-based generation failed');
      
      // Update job status with error
      jobStatus.set(projectId, {
        status: 'error',
        created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error: result.error || 'Unknown error'
      });

      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to generate panel layout',
        error: result.error || 'Unknown error',
        jobId: projectId
      });
      return;
    }

    // Success case
    logger.debug('[AI ROUTE] Panel requirements-based generation successful');
    
    // Update job status with success
    jobStatus.set(projectId, {
      status: result.status || 'success',
      created_at: jobStatus.get(projectId)?.created_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      actions: result.actions,
      summary: result.summary,
      analysis: result.analysis,
      confidence: result.confidence
    });

    res.json({
      success: true,
      status: result.status || 'success',
      actions: result.actions,
      summary: result.summary,
      analysis: result.analysis,
      confidence: result.confidence,
      jobId: projectId
    });

  } catch (error) {
    logger.error('[AI ROUTE] Error in automate-layout', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    
    // Update job status with error
    jobStatus.set(req.body.projectId, {
      status: 'error',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error: error.message
    });

    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to generate panel layout',
      error: error.message
    });
  }
});

// New endpoint to execute AI-generated layout actions
router.post('/execute-ai-layout', requireAuth, async (req, res) => {
  try {
    const { projectId, actions } = req.body;

    if (!projectId || !actions || !Array.isArray(actions)) {
      return res.status(400).json({ 
        error: 'Project ID and actions array are required' 
      });
    }

    // Import the panel layout service
    const panelLayoutService = require('../services/panelLayoutService');

    const results = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'CREATE_PANEL':
            const newPanel = await panelLayoutService.createPanel(projectId, action.data || action.payload);
            results.push({ 
              success: true, 
              type: 'CREATE_PANEL', 
              panel: newPanel,
              actionId: action.id 
            });
            break;

          case 'MOVE_PANEL':
            const moveData = action.data || action.payload;
            
            // Validate newPosition before moving
            if (!moveData.newPosition || typeof moveData.newPosition !== 'object') {
              results.push({ 
                success: false, 
                type: 'MOVE_PANEL', 
                error: 'Invalid newPosition: must be an object',
                actionId: action.id 
              });
              break;
            }
            
            // Validate rotation if present
            if (moveData.newPosition.rotation !== undefined) {
              const rotation = moveData.newPosition.rotation;
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
              moveData.panelId, 
              moveData.newPosition
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
              (action.data || action.payload).panelId
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
    logger.error('Error executing AI layout', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({
      error: 'Failed to execute AI layout',
      details: error.message
    });
  }
});

// Job status endpoint
router.get('/job-status/:projectId', requireAuth, (req, res) => {
  const { projectId } = req.params;
  const status = jobStatus.get(projectId) || { status: 'idle' };
  
  res.json(status);
});

// Extract data from documents endpoint
router.post('/extract-data', requireAuth, async (req, res) => {
  try {
    const { documents, extractionType = 'qc_data' } = req.body;

    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'Documents are required' });
    }

    let documentContent = '';
    documents.forEach(doc => {
      if (doc.text) {
        documentContent += `Document: ${doc.filename}\n${doc.text}\n\n`;
      }
    });

    const extractionPrompts = {
      qc_data: "Extract quality control test data, measurements, and results from these documents. Include test dates, values, pass/fail status, and standards referenced.",
      material_specs: "Extract material specifications, properties, and technical parameters from these documents.",
      site_info: "Extract site information including dimensions, coordinates, soil conditions, and environmental factors.",
      test_results: "Extract all test results, measurements, and quality assurance data with their corresponding values and units."
    };

    const prompt = `${extractionPrompts[extractionType] || extractionPrompts.qc_data}

Documents:
${documentContent}

Please extract the data in a structured JSON format with appropriate fields for the extracted information. Include source document references where possible.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a data extraction specialist for geosynthetic engineering documents. Extract structured data accurately and completely."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.2
    });

    const extractedData = JSON.parse(response.choices[0].message.content);

    res.json({
      extractedData,
      extractionType,
      documentsProcessed: documents.length,
      tokensUsed: response.usage?.total_tokens || 0
    });

  } catch (error) {
    logger.error('Error in data extraction', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ 
      error: 'Failed to extract data from documents',
      details: error.message 
    });
  }
});

// Enhanced document analysis for panel requirements (Phase 2)
router.post('/analyze-panel-requirements', requireAuth, async (req, res) => {
  try {
    const { projectId, documentIds } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!documentIds || documentIds.length === 0) {
      return res.status(400).json({ error: 'Document IDs are required' });
    }

    logger.debug(`[AI ROUTE] Phase 2: Analyzing ${documentIds.length} documents for panel requirements in project ${projectId}`);
    logger.debug(`[AI ROUTE] Document IDs received:`, documentIds);

    // Import enhanced services for Phase 2
    const EnhancedDocumentAnalyzer = require('../services/enhancedDocumentAnalyzer');
    const EnhancedValidationService = require('../services/enhancedValidationService');
    const EnhancedConfidenceService = require('../services/enhancedConfidenceService');
    
    // Import Phase 3 services
    const Phase3AILayoutGenerator = require('../services/phase3AILayoutGenerator');
    
    // Instantiate enhanced services
    const enhancedDocumentAnalyzer = new EnhancedDocumentAnalyzer();
    const enhancedValidationService = new EnhancedValidationService();
    const enhancedConfidenceService = new EnhancedConfidenceService();
    
    // Instantiate Phase 3 services
    const phase3AILayoutGenerator = new Phase3AILayoutGenerator();
    const documentService = require('../services/documentService');
    const panelRequirementsService = require('../services/panelRequirementsService');

    // Fetch document content from database using document IDs
    let enhancedDocuments = [];
    try {
      enhancedDocuments = await Promise.all(
        documentIds.map(async (docId) => {
          try {
            logger.debug(`[AI ROUTE] Processing document ID: ${docId}`);
            const documentText = await documentService.getDocumentText(docId);
            // Get document metadata from database
            const { db } = require('../db/index');
            const { documents } = require('../db/schema');
            const { eq } = require('drizzle-orm');
            
            const [doc] = await db
              .select()
              .from(documents)
              .where(eq(documents.id, docId));
            
            logger.debug(`[AI ROUTE] Document metadata for ${docId}:`, {
              name: doc?.name,
              type: doc?.type,
              size: doc?.size,
              hasTextContent: !!documentText,
              textContentLength: documentText ? documentText.length : 0
            });
            
            return {
              id: docId,
              text: documentText,
              filename: doc?.name || 'Unknown document',
              type: doc?.type || 'application/octet-stream',
              size: doc?.size || 0
            };
          } catch (textError) {
            logger.warn(`[AI ROUTE] Text extraction failed for ${docId}`, {
              message: textError.message
            });
            return {
              id: docId,
              text: '',
              filename: 'Unknown document',
              type: 'application/octet-stream',
              size: 0
            };
          }
        })
      );
    } catch (enhanceError) {
      logger.warn('[AI ROUTE] Document enhancement failed', {
        message: enhanceError.message
      });
      return res.status(500).json({ error: 'Failed to fetch document content' });
    }

    // Phase 2: Enhanced document analysis with advanced parsing and validation
    const enhancedAnalysisResult = await enhancedDocumentAnalyzer.analyzeDocumentsEnhanced(enhancedDocuments, { projectId });
    
    logger.debug(`[AI ROUTE] Phase 2: Enhanced analysis completed with confidence: ${enhancedAnalysisResult.confidence}%`);

    // Phase 2: Enhanced validation with detailed results
    const validationResults = await enhancedValidationService.validateExtractedData(enhancedAnalysisResult);
    
    logger.debug(`[AI ROUTE] Phase 2: Validation completed. Valid: ${validationResults.isValid}, Issues: ${validationResults.issues.length}`);

    // Phase 2: Enhanced confidence calculation with detailed breakdown
    const confidenceResults = await enhancedConfidenceService.calculateEnhancedConfidence(enhancedAnalysisResult, validationResults);
    
    logger.debug(`[AI ROUTE] Phase 2: Enhanced confidence calculation completed. Overall: ${confidenceResults.overall}%`);

    // Extract panel requirements from enhanced analysis
    const extractedRequirements = {
      panelSpecifications: {
        panelCount: enhancedAnalysisResult.panelSpecifications?.length || 0,
        dimensions: extractPanelDimensions(enhancedAnalysisResult.panelSpecifications),
        materials: extractMaterials(enhancedAnalysisResult.panelSpecifications, enhancedAnalysisResult.materialRequirements),
        panelNumbers: enhancedAnalysisResult.panelSpecifications?.map(p => p.panelId) || [],
        rollNumbers: extractRollNumbers(enhancedAnalysisResult.panelSpecifications),
        confidence: enhancedAnalysisResult.panelSpecifications?.map(p => p.confidence) || [],
        // Include the actual panel specifications for layout generation
        panelSpecifications: enhancedAnalysisResult.panelSpecifications || []
      },
      materialRequirements: {
        primaryMaterial: extractPrimaryMaterial(enhancedAnalysisResult.panelSpecifications),
        thickness: extractThickness(enhancedAnalysisResult.panelSpecifications),
        seamRequirements: enhancedAnalysisResult.materialRequirements?.seamRequirements || 'Standard 6-inch overlap',
        secondaryMaterial: enhancedAnalysisResult.materialRequirements?.secondaryMaterial || null,
        qualityStandards: enhancedAnalysisResult.materialRequirements?.qualityStandards || []
      },
      rollInventory: {
        rolls: enhancedAnalysisResult.rollInformation?.map(roll => ({
          id: roll.rollNumber,
          dimensions: `${roll.dimensions?.width || 0}ft x ${roll.dimensions?.length || 0}ft`,
          quantity: 1,
          status: roll.status || 'available',
          confidence: roll.confidence || 0
        })) || [],
        totalQuantity: enhancedAnalysisResult.rollInformation?.length || 0,
        totalArea: enhancedAnalysisResult.rollInformation?.reduce((total, roll) => {
          return total + (roll.dimensions?.width * roll.dimensions?.length || 0);
        }, 0) || 0
      },
      installationNotes: {
        requirements: extractInstallationRequirements(enhancedAnalysisResult.installationNotes),
        constraints: extractInstallationConstraints(enhancedAnalysisResult.siteConstraints),
        notes: extractInstallationNotes(enhancedAnalysisResult.installationNotes),
        safety: enhancedAnalysisResult.installationNotes?.safety || {}
      },
      siteDimensions: {
        width: enhancedAnalysisResult.siteConstraints?.siteDimensions?.width || null,
        length: enhancedAnalysisResult.siteConstraints?.siteDimensions?.length || null,
        terrainType: enhancedAnalysisResult.siteConstraints?.terrain?.type || 'flat',
        constraints: enhancedAnalysisResult.siteConstraints?.constraints || []
      }
    };

    // Phase 2: Enhanced missing requirements analysis
    const missingRequirements = panelRequirementsService.getMissingRequirements(extractedRequirements);

    // Save extracted requirements to database
    const savedRequirements = await panelRequirementsService.upsertRequirements(projectId, extractedRequirements);

    logger.debug(`[AI ROUTE] Panel requirements extracted and saved with confidence: ${confidenceResults.overall}%`);
    logger.debug(`[AI ROUTE] Saved panel specifications:`, {
      panelCount: extractedRequirements.panelSpecifications.panelCount,
      actualPanels: extractedRequirements.panelSpecifications.panelSpecifications?.length || 0,
      hasPanelData: !!extractedRequirements.panelSpecifications.panelSpecifications?.length,
      panelData: extractedRequirements.panelSpecifications.panelSpecifications?.slice(0, 3) || 'No panel data'
    });

    res.json({
      success: true,
      requirements: extractedRequirements,
      confidence: confidenceResults.overall,
      missingRequirements,
      analysis: {
        documentTypes: enhancedAnalysisResult.documentTypes,
        panelSpecifications: enhancedAnalysisResult.panelSpecifications,
        rollInformation: enhancedAnalysisResult.rollInformation,
        materialRequirements: enhancedAnalysisResult.materialRequirements,
        siteConstraints: enhancedAnalysisResult.siteConstraints,
        installationNotes: enhancedAnalysisResult.installationNotes
      },
      savedRequirements
    });

  } catch (error) {
    logger.error('[AI ROUTE] Error analyzing panel requirements', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to analyze documents for panel requirements',
      details: error.message
    });
  }
});

// Phase 3: Advanced AI Layout Generation Route
router.post('/generate-advanced-layout', requireAuth, async (req, res) => {
  try {
    logger.debug('[AI ROUTE] Phase 3: Advanced layout generation request received');
    
    const { projectId, options = {} } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    logger.debug('[AI ROUTE] Phase 3: Generating advanced layout for project:', projectId);
    logger.debug('[AI ROUTE] Phase 3: Options:', options);

    // Import Phase 3 services if not already imported
    const Phase3AILayoutGenerator = require('../services/phase3AILayoutGenerator');
    const phase3AILayoutGenerator = new Phase3AILayoutGenerator();

    // Generate advanced layout using Phase 3 AI Layout Generator
    const result = await phase3AILayoutGenerator.generateAdvancedLayout(projectId, options);

    logger.debug('[AI ROUTE] Phase 3: Advanced layout generation completed');
    logger.debug('[AI ROUTE] Phase 3: Result status:', result.success);
    logger.debug('[AI ROUTE] Phase 3: Panel count:', result.layout?.length || 0);

    res.json(result);

  } catch (error) {
    logger.error('[AI ROUTE] Phase 3: Error generating advanced layout', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate advanced layout',
      details: error.message,
      phase: '3'
    });
  }
});

// Helper methods for extracting specific data
function extractPanelDimensions(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) return null;
  
  const dimensions = panelSpecs.map(p => `${p.dimensions?.width || 0}ft x ${p.dimensions?.length || 0}ft`);
  return dimensions.join(', ');
}

function extractMaterials(panelSpecs, materialReqs) {
  // Material information is optional for panel generation
  // Return default if no material information is available
  if (!materialReqs && (!panelSpecs || panelSpecs.length === 0)) {
    return 'Material type not specified - will be determined during installation';
  }
  
  const materials = new Set();
  
  if (materialReqs?.primaryMaterial?.type) {
    materials.add(materialReqs.primaryMaterial.type);
  }
  
  if (panelSpecs) {
    panelSpecs.forEach(p => {
      if (p.material?.type) materials.add(p.material.type);
    });
  }
  
  return Array.from(materials).join(', ') || 'Material type not specified - will be determined during installation';
}

function extractPrimaryMaterial(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) {
    return 'Material type not specified - will be determined during installation';
  }
  
  const materialCounts = {};
  panelSpecs.forEach(p => {
    if (p.material?.type) {
      materialCounts[p.material.type] = (materialCounts[p.material.type] || 0) + 1;
    }
  });
  
  return Object.keys(materialCounts).sort((a, b) => materialCounts[b] - materialCounts[a])[0] || 
         'Material type not specified - will be determined during installation';
}

function extractThickness(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) {
    return 'Thickness not specified - will be determined during installation';
  }
  
  const thicknesses = panelSpecs.map(p => p.material?.thickness).filter(t => t);
  if (thicknesses.length === 0) {
    return 'Thickness not specified - will be determined during installation';
  }
  
  return thicknesses[0] + ' mils';
}

function extractRollNumbers(panelSpecs) {
  if (!panelSpecs || panelSpecs.length === 0) return [];
  
  return panelSpecs.map(p => p.rollNumber).filter(r => r);
}

function extractInstallationRequirements(installationNotes) {
  if (!installationNotes || installationNotes.length === 0) {
    return 'Standard geosynthetic installation procedures';
  }
  
  return installationNotes.map(note => note.requirements).filter(r => r).join('; ') || 
         'Standard geosynthetic installation procedures';
}

function extractInstallationConstraints(siteConstraints) {
  if (!siteConstraints) return 'Standard site constraints apply';
  
  const constraints = [];
  if (siteConstraints.obstacles && siteConstraints.obstacles.length > 0) {
    constraints.push(`Site obstacles: ${siteConstraints.obstacles.join(', ')}`);
  }
  if (siteConstraints.terrainType && siteConstraints.terrainType !== 'flat') {
    constraints.push(`Terrain type: ${siteConstraints.terrainType}`);
  }
  
  return constraints.join('; ') || 'Standard site constraints apply';
}

function extractInstallationNotes(installationNotes) {
  if (!installationNotes || installationNotes.length === 0) {
    return 'Follow manufacturer specifications and industry standards';
  }
  
  return installationNotes.map(note => note.notes).filter(n => n).join('; ') || 
         'Follow manufacturer specifications and industry standards';
}

// Test endpoint for enhanced AI services
router.get('/test-enhanced', requireAuth, async (req, res) => {
  try {
    // Test the enhanced layout generator
    const enhancedAILayoutGenerator = require('../services/enhancedAILayoutGenerator');
    const panelDocumentAnalyzer = require('../services/panelDocumentAnalyzer');
    
    // Test with sample data
    const testDocuments = [
      {
        filename: 'test-panel-specs.txt',
        text: 'Panel P001: Roll Number: R001, Dimensions: 40 ft x 100 ft, Material: HDPE, Thickness: 60 mils'
      }
    ];
    
    const result = await enhancedAILayoutGenerator.generateLayoutActions(testDocuments, 'test-project');
    
    res.json({
      success: true,
      message: 'Enhanced AI services are working correctly',
      testResult: {
        success: result.success,
        actionsCount: result.actions?.length || 0,
        analysis: result.analysis ? {
          confidence: result.analysis.confidence,
          documentTypes: result.analysis.documentTypes,
          panelSpecsCount: result.analysis.panelSpecifications?.length || 0
        } : null
      }
    });
    
  } catch (error) {
    logger.error('[AI TEST] Error testing enhanced services', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ 
      success: false,
      error: 'Enhanced AI services test failed',
      details: error.message 
    });
  }
});

// Test endpoint to verify document analysis workflow
router.post('/test-document-analysis', requireAuth, async (req, res) => {
  try {
    const { projectId, documents } = req.body;

    logger.debug(`[TEST] Testing document analysis for project ${projectId}`);
    logger.debug(`[TEST] Documents provided: ${documents?.length || 0}`);

    // Test document enhancement
    let enhancedDocuments = documents || [];
    if (enhancedDocuments.length > 0) {
      logger.debug('[TEST] Testing document enhancement...');
      
      try {
        const documentService = require('../services/documentService');
        
        enhancedDocuments = await Promise.all(
          enhancedDocuments.map(async (doc) => {
            logger.debug(`[TEST] Processing document: ${doc.name || doc.id}`);
            if (!doc.text && doc.id) {
              try {
                const documentText = await documentService.getDocumentText(doc.id);
                logger.debug(`[TEST] Extracted text length: ${documentText ? documentText.length : 0}`);
                return {
                  ...doc,
                  text: documentText,
                  filename: doc.name || doc.filename
                };
              } catch (textError) {
                logger.warn(`[TEST] Text extraction failed for ${doc.id}`, {
                  message: textError.message
                });
                return doc;
              }
            }
            return {
              ...doc,
              filename: doc.name || doc.filename
            };
          })
        );
      } catch (enhanceError) {
        logger.warn('[TEST] Document enhancement failed', {
          message: enhanceError.message
        });
      }
    }

    // Test document categorization
    const panelDocumentAnalyzer = require('../services/panelDocumentAnalyzer');
    const categories = panelDocumentAnalyzer.categorizeDocuments(enhancedDocuments);
    
    logger.debug('[TEST] Document categorization results:');
    Object.entries(categories).forEach(([category, docs]) => {
      logger.debug(`[TEST] ${category}: ${docs.length} documents`);
      docs.forEach(doc => {
        logger.debug(`[TEST]   - ${doc.name || doc.filename} (text: ${doc.text ? 'yes' : 'no'})`);
      });
    });

    // Test AI analysis
    const analysis = await panelDocumentAnalyzer.analyzePanelDocuments(enhancedDocuments);
    
    logger.debug('[TEST] AI analysis results:', {
      confidence: analysis.confidence,
      panelCount: analysis.panels?.length || 0,
      rollCount: analysis.rolls?.length || 0,
      siteInfo: !!analysis.siteInfo,
      materialInfo: !!analysis.materialInfo,
      installationInfo: !!analysis.installationInfo
    });

    res.json({
      success: true,
      testResults: {
        documentsProcessed: enhancedDocuments.length,
        documentsWithText: enhancedDocuments.filter(d => d.text).length,
        categorization: categories,
        analysis: {
          confidence: analysis.confidence,
          panelCount: analysis.panels?.length || 0,
          rollCount: analysis.rolls?.length || 0,
          hasSiteInfo: !!analysis.siteInfo,
          hasMaterialInfo: !!analysis.materialInfo,
          hasInstallationInfo: !!analysis.installationInfo
        }
      }
    });

  } catch (error) {
    logger.error('[TEST] Error in document analysis test', {
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    res.status(500).json({ 
      success: false,
      error: 'Test failed',
      details: error.message 
    });
  }
});

module.exports = router;
