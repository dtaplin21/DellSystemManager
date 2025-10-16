const path = require('path');
const fs = require('fs');

let tsNodeRegistered = false;

function ensureTsNode() {
  if (tsNodeRegistered) {
    return;
  }

  const tsNode = require('ts-node');
  const projectPath = path.join(__dirname, '../../tsconfig.orchestrator.json');
  tsNode.register({
    project: projectPath,
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs'
    }
  });
  tsNodeRegistered = true;
}

ensureTsNode();

const { createEventBus } = require('../../src/orchestrator/eventBus');
const { createWorkflowRunManager } = require('../../src/orchestrator/run');
const { createAsbuiltAutomationDefinition } = require('../../src/workflows/asbuiltAutomation');

class StructuredWorkflowOrchestrator {
  constructor(options = {}) {
    this.outputRoot = options.outputRoot || path.join(process.cwd(), 'out');
    this.logRoot = options.logRoot || path.join(process.cwd(), 'logs', 'runs');

    this.eventBus = createEventBus({
      onError: (error, event) => {
        // eslint-disable-next-line no-console
        console.error(`[Workflow EventBus] handler error for ${event}:`, error);
      }
    });

    this.definition = createAsbuiltAutomationDefinition();
    this.runManager = createWorkflowRunManager(this.definition, {
      eventBus: this.eventBus,
      outputRoot: this.outputRoot,
      logRoot: this.logRoot
    });

    this.ensureDirectories();
    this.registerLogging();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.outputRoot)) {
      fs.mkdirSync(this.outputRoot, { recursive: true });
    }
    if (!fs.existsSync(this.logRoot)) {
      fs.mkdirSync(this.logRoot, { recursive: true });
    }
  }

  registerLogging() {
    this.eventBus.subscribe('run.completed', (event) => {
      // eslint-disable-next-line no-console
      console.log('[Workflow] Run completed', {
        runId: event.context.runId,
        status: event.status,
        failedStep: event.payload?.failedStep
      });
    });
  }

  async runAsbuiltAutomation(options) {
    if (!options?.excelPath) {
      throw new Error('excelPath is required to start the as-built automation run');
    }

    const initialInput = {
      excelPath: options.excelPath,
      domain: options.domain,
      fileId: options.fileId,
      fileName: options.fileName,
      handwrittenFilePath: options.handwrittenFilePath,
      handwrittenMimeType: options.handwrittenMimeType
    };

    return this.runManager.executeRun({
      projectId: options.projectId,
      userId: options.userId,
      workflowId: this.definition.id,
      initialInput,
      metadata: options.metadata
    });
  }
}

module.exports = new StructuredWorkflowOrchestrator();
