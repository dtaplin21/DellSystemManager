#!/usr/bin/env node

/**
 * DellSystemManager MCP Server
 * Provides AI tools for both internal team and external customers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Pool } from 'pg';
import winston from 'winston';
import Joi from 'joi';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('./config-wrapper.cjs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Initialize logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, config.logging.file.error), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, config.logging.file.combined) 
    })
  ]
});

if (config.logging.console.enabled) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Initialize database connection
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  max: config.database.maxConnections
});

// Test database connection
pool.on('connect', () => {
  logger.info('Database connected successfully');
});

pool.on('error', (err) => {
  logger.error('Database connection error:', err);
});

// Utility functions
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function isInternalUser(email) {
  if (!email) return false;
  return config.auth.internal.allowedEmails.some(allowedEmail => 
    email.toLowerCase() === allowedEmail.toLowerCase()
  );
}

// Input validation schemas
const toolSchemas = {
  get_projects: Joi.object({
    // No parameters needed
  }),
  
  get_project_panels: Joi.object({
    projectId: Joi.string().uuid().required()
  }),
  
  get_asbuilt_records: Joi.object({
    projectId: Joi.string().uuid().required(),
    panelId: Joi.string().uuid().optional()
  }),
  
  import_asbuilt_excel: Joi.object({
    projectId: Joi.string().uuid().required(),
    filePath: Joi.string().min(1).max(500).required(),
    domain: Joi.string().valid('panel_placement', 'panel_seaming', 'panel_testing', 'destructive').optional()
  }),
  
  query_database: Joi.object({
    query: Joi.string().pattern(/^SELECT/i).max(config.security.maxQueryLength).required()
  }),
  
  search_records: Joi.object({
    projectId: Joi.string().uuid().required(),
    searchTerm: Joi.string().min(1).max(100).required(),
    domain: Joi.string().optional()
  }),
  
  generate_report: Joi.object({
    projectId: Joi.string().uuid().required(),
    reportType: Joi.string().valid('summary', 'compliance', 'quality').required(),
    dateRange: Joi.object({
      start: Joi.date().optional(),
      end: Joi.date().optional()
    }).optional()
  })
};

// Create MCP server
const server = new Server(
  {
    name: config.server.name,
    version: config.server.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools based on mode
function getAvailableTools() {
  const baseTools = [
    {
      name: 'get_projects',
      description: 'Get all projects accessible to the user',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_project_panels',
      description: 'Get all panels for a specific project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID (UUID)',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_asbuilt_records',
      description: 'Get asbuilt records for a project or specific panel',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID',
          },
          panelId: {
            type: 'string',
            description: 'The panel ID (optional)',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'search_records',
      description: 'Search asbuilt records by text',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID',
          },
          searchTerm: {
            type: 'string',
            description: 'Search term',
          },
          domain: {
            type: 'string',
            description: 'Filter by domain (optional)',
          },
        },
        required: ['projectId', 'searchTerm'],
      },
    },
    {
      name: 'generate_report',
      description: 'Generate a report for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID',
          },
          reportType: {
            type: 'string',
            enum: ['summary', 'compliance', 'quality'],
            description: 'Type of report to generate',
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date' },
              end: { type: 'string', format: 'date' }
            },
            description: 'Date range for the report (optional)',
          },
        },
        required: ['projectId', 'reportType'],
      },
    }
  ];

  // Add internal-only tools
  if (config.server.mode === 'internal') {
    baseTools.push(
      {
        name: 'query_database',
        description: 'Execute a read-only SQL query (admin only)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL SELECT query',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'import_asbuilt_excel',
        description: 'Import asbuilt data from Excel file',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'The project ID',
            },
            filePath: {
              type: 'string',
              description: 'Path to Excel file',
            },
            domain: {
              type: 'string',
              description: 'Domain type (panel_placement, panel_seaming, etc.)',
            },
          },
          required: ['projectId', 'filePath'],
        },
      }
    );
  }

  return baseTools;
}

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info('List tools requested');
  return {
    tools: getAvailableTools(),
  };
});

// Tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const { name, arguments: args } = request.params;

  logger.info('Tool call received', {
    requestId,
    tool: name,
    args: args,
    timestamp: new Date().toISOString()
  });

  try {
    // Validate input
    const schema = toolSchemas[name];
    if (!schema) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const { error, value } = schema.validate(args);
    if (error) {
      throw new Error(`Invalid input: ${error.details[0].message}`);
    }

    // Check permissions
    if (config.server.mode === 'internal') {
      // For internal mode, check if user is in allowed list
      const userEmail = request.params._meta?.userEmail;
      if (config.auth.internal.requireAuth && !isInternalUser(userEmail)) {
        throw new Error('Access denied - internal tool requires authorized email');
      }
    }

    // Execute tool
    const result = await executeTool(name, value, requestId);
    
    logger.info('Tool call completed', {
      requestId,
      tool: name,
      duration: Date.now() - startTime,
      success: true
    });

    return result;

  } catch (error) {
    logger.error('Tool call failed', {
      requestId,
      tool: name,
      error: {
        message: error.message,
        stack: error.stack
      },
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`,
      }],
      isError: true,
    };
  }
});

// Tool execution functions
async function executeTool(toolName, args, requestId) {
  switch (toolName) {
    case 'get_projects': {
      const result = await pool.query(
        'SELECT id, name, description, status, location, created_at FROM projects ORDER BY created_at DESC LIMIT 50'
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.rows, null, 2),
        }],
      };
    }

    case 'get_project_panels': {
      const { projectId } = args;
      const result = await pool.query(
        'SELECT panels FROM panel_layouts WHERE project_id = $1',
        [projectId]
      );
      
      if (result.rows.length === 0) {
        return {
          content: [{ type: 'text', text: 'No panels found for this project' }],
        };
      }

      const panels = result.rows[0].panels || [];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(panels, null, 2),
        }],
      };
    }

    case 'get_asbuilt_records': {
      const { projectId, panelId } = args;
      let query = `
        SELECT id, domain, mapped_data, ai_confidence, created_at, panel_id
        FROM asbuilt_records 
        WHERE project_id = $1
      `;
      const params = [projectId];
      
      if (panelId) {
        query += ' AND panel_id = $2';
        params.push(panelId);
      }
      
      query += ' ORDER BY created_at DESC LIMIT 100';
      
      const result = await pool.query(query, params);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.rows, null, 2),
        }],
      };
    }

    case 'search_records': {
      const { projectId, searchTerm, domain } = args;
      let query = `
        SELECT id, domain, mapped_data, ai_confidence, created_at, panel_id
        FROM asbuilt_records 
        WHERE project_id = $1 AND (
          mapped_data::text ILIKE $2 OR
          raw_data::text ILIKE $2
        )
      `;
      const params = [projectId, `%${searchTerm}%`];
      
      if (domain) {
        query += ' AND domain = $3';
        params.push(domain);
      }
      
      query += ' ORDER BY created_at DESC LIMIT 50';
      
      const result = await pool.query(query, params);
      return {
        content: [{
          type: 'text',
          text: `Found ${result.rows.length} records matching "${searchTerm}":\n\n${JSON.stringify(result.rows, null, 2)}`,
        }],
      };
    }

    case 'generate_report': {
      const { projectId, reportType, dateRange } = args;
      
      // Get project info
      const projectResult = await pool.query(
        'SELECT name, description, status FROM projects WHERE id = $1',
        [projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      const project = projectResult.rows[0];
      
      // Get records count by domain
      const domainResult = await pool.query(`
        SELECT domain, COUNT(*) as count, AVG(ai_confidence) as avg_confidence
        FROM asbuilt_records 
        WHERE project_id = $1
        GROUP BY domain
        ORDER BY count DESC
      `, [projectId]);
      
      const report = {
        project: project,
        reportType: reportType,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRecords: domainResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
          domains: domainResult.rows
        }
      };
      
      return {
        content: [{
          type: 'text',
          text: `# ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report for ${project.name}\n\n${JSON.stringify(report, null, 2)}`,
        }],
      };
    }

    case 'query_database': {
      const { query } = args;
      
      // Security: Only allow SELECT queries
      if (!query.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
      }

      const result = await pool.query(query);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.rows, null, 2),
        }],
      };
    }

    case 'import_asbuilt_excel': {
      const { projectId, filePath, domain } = args;
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Check file size
      const stats = fs.statSync(filePath);
      if (stats.size > config.security.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${config.security.maxFileSize})`);
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      const { default: AsbuiltImportAI } = await import('../services/asbuiltImportAI.js');
      
      const importService = new AsbuiltImportAI();
      const result = await importService.importExcelData(
        fileBuffer,
        projectId,
        domain || null,
        'mcp-user'
      );

      return {
        content: [{
          type: 'text',
          text: `Import successful!\nRecords imported: ${result.importedRows}\nDomain: ${result.detectedDomain}\nConfidence: ${result.confidence}`,
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Start server
async function main() {
  try {
    logger.info('Starting MCP server', {
      mode: config.server.mode,
      version: config.server.version,
      database: config.database.url ? 'connected' : 'not configured'
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('MCP server running on stdio', {
      mode: config.server.mode,
      tools: getAvailableTools().length
    });
    
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down MCP server...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down MCP server...');
  await pool.end();
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Server error:', error);
  process.exit(1);
});
