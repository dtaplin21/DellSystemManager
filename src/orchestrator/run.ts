import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  AgentExecutionResult,
  Artifact,
  ArtifactSchema,
  DoDChecklist,
  EventEnvelope,
  RunContext,
  RunContextSchema,
  StepOutput,
  StepOutputSchema,
  WorkflowDefinition,
  WorkflowStatus
} from '../contracts';
import { WorkflowDAG } from './dag';
import { RunLogger } from './logger';
import { TypedEventBus } from './eventBus';

export interface WorkflowRunManagerOptions {
  dag: WorkflowDAG;
  eventBus: TypedEventBus;
  outputRoot: string;
  logRoot: string;
}

export interface ExecuteRunOptions {
  projectId: string;
  userId?: string | null;
  workflowId?: string;
  runId?: string;
  initialInput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowRunSummary {
  context: RunContext;
  status: WorkflowStatus;
  steps: Record<string, StepOutput>;
  artifacts: Record<string, Artifact>;
  events: EventEnvelope[];
}

interface StoredArtifact extends Artifact {
  data?: unknown;
}

const DEFAULT_RETRY_BASE_MS = 1500;

const wait = (duration: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, duration));

const hashPayload = (payload: unknown): string => {
  const serialized = JSON.stringify(payload ?? {});
  return crypto.createHash('sha256').update(serialized).digest('hex');
};

const normalizeStepId = (stepId: string): string => stepId.replace(/[^a-zA-Z0-9-_]/g, '_');

export class WorkflowRunManager {
  private readonly dag: WorkflowDAG;
  private readonly eventBus: TypedEventBus;
  private readonly outputRoot: string;
  private readonly logger: RunLogger;

  constructor(options: WorkflowRunManagerOptions) {
    this.dag = options.dag;
    this.eventBus = options.eventBus;
    this.outputRoot = options.outputRoot;
    this.logger = new RunLogger({ logRoot: options.logRoot });
  }

  async executeRun(options: ExecuteRunOptions): Promise<WorkflowRunSummary> {
    const workflowId = options.workflowId ?? this.dag.getId();
    const runId = options.runId ?? this.generateRunId(workflowId);

    const context = RunContextSchema.parse({
      runId,
      workflow: workflowId,
      projectId: options.projectId,
      userId: options.userId ?? null,
      timestamp: new Date().toISOString(),
      metadata: options.metadata ?? {}
    });

    const runArtifacts: Record<string, Artifact> = {};
    const stepResults: Record<string, StepOutput> = {};
    const events: EventEnvelope[] = [];
    const idempotencyCache = new Map<string, StepOutput>();

    await this.logger.append(runId, {
      level: 'info',
      event: 'run.started',
      workflowId,
      projectId: context.projectId
    });

    const executionOrder = this.dag.getExecutionOrder();
    let failureStep: string | null = null;

    for (const stepId of executionOrder) {
      if (failureStep) {
        stepResults[stepId] = StepOutputSchema.parse({
          status: 'BLOCKED',
          reason: `Blocked due to failure in ${failureStep}`
        });
        await this.logger.append(runId, {
          level: 'warn',
          event: 'step.blocked',
          stepId,
          reason: `Blocked due to failure in ${failureStep}`
        });
        continue;
      }

      const step = this.dag.getStep(stepId);
      const unmetDependencies = (step.dependsOn ?? []).filter(
        (dependencyId) => stepResults[dependencyId]?.status !== 'PASS'
      );

      if (unmetDependencies.length > 0) {
        failureStep = unmetDependencies[0];
        stepResults[stepId] = StepOutputSchema.parse({
          status: 'BLOCKED',
          reason: `Dependencies not satisfied: ${unmetDependencies.join(', ')}`
        });
        await this.logger.append(runId, {
          level: 'warn',
          event: 'step.blocked',
          stepId,
          reason: stepResults[stepId].reason
        });
        continue;
      }

      const input = step.buildInput
        ? await step.buildInput({
            context,
            previousResults: stepResults,
            initialInput: options.initialInput ?? {}
          })
        : options.initialInput ?? {};

      if (input === null || input === undefined) {
        if (step.optional) {
          const skipped = StepOutputSchema.parse({
            status: 'PASS',
            skip: true,
            reason: 'Step skipped because no input was provided.'
          });
          stepResults[stepId] = skipped;
          await this.logger.append(runId, {
            level: 'info',
            event: 'step.skipped',
            stepId,
            reason: skipped.reason
          });
          continue;
        }

        failureStep = stepId;
        stepResults[stepId] = StepOutputSchema.parse({
          status: 'FAIL',
          reason: 'Required input not provided.'
        });
        await this.logger.append(runId, {
          level: 'error',
          event: 'step.failed',
          stepId,
          reason: 'Required input not provided.'
        });
        break;
      }

      const retryPolicy = step.retryPolicy ?? {
        maxAttempts: 1,
        baseDelayMs: DEFAULT_RETRY_BASE_MS,
        retryableStatuses: ['RETRY'] as WorkflowStatus[]
      };

      let attempt = 0;
      let stepResult: StepOutput | null = null;
      const idempotencyKey = step.idempotencyKey
        ? await step.idempotencyKey({
            context,
            input,
            previousResults: stepResults,
            initialInput: options.initialInput ?? {}
          })
        : null;

      if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
        stepResult = idempotencyCache.get(idempotencyKey) ?? null;
        if (stepResult) {
          stepResults[stepId] = stepResult;
          await this.logger.append(runId, {
            level: 'info',
            event: 'step.reused',
            stepId,
            reason: 'Idempotency cache hit',
            attempt
          });
          continue;
        }
      }

      while (attempt < retryPolicy.maxAttempts) {
        attempt += 1;
        const startTime = new Date().toISOString();
        await this.logger.append(runId, {
          level: 'info',
          event: 'step.started',
          stepId,
          attempt
        });

        let executionResult: AgentExecutionResult;

        try {
          executionResult = await step.execute({
            context,
            input,
            attempt,
            previousResults: stepResults,
            initialInput: options.initialInput ?? {},
            logger: async (message, details) =>
              this.logger.append(runId, {
                level: 'debug',
                event: 'step.log',
                stepId,
                message,
                details
              })
          });
        } catch (error) {
          executionResult = {
            status: 'FAIL',
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          };
        }

        let parsedResult: StepOutput;
        try {
          parsedResult = StepOutputSchema.parse({
            ...executionResult,
            attempt,
            startedAt: startTime,
            finishedAt: new Date().toISOString()
          });
        } catch (error) {
          parsedResult = StepOutputSchema.parse({
            status: 'FAIL',
            attempt,
            reason: 'Step returned invalid payload',
            error: {
              message:
                error instanceof Error ? error.message : 'Unknown validation error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });
        }

        if (parsedResult.status === 'PASS' && step.dod) {
          const dodValid = await this.validateDoD(step.dod, context, parsedResult);
          if (!dodValid) {
            parsedResult = {
              ...parsedResult,
              status: 'FAIL',
              reason: 'Definition of Done validation failed'
            };
          }
        }

        const storedArtifacts = await this.persistArtifacts(runId, stepId, parsedResult.artifacts ?? []);
        parsedResult = {
          ...parsedResult,
          artifacts: storedArtifacts
        };

        storedArtifacts.forEach((artifact) => {
          runArtifacts[artifact.id] = artifact;
        });

        const eventName =
          parsedResult.status === 'PASS'
            ? step.successEvent ?? `step.${stepId}.completed`
            : step.failureEvent ?? `step.${stepId}.failed`;

        const envelope: EventEnvelope = {
          event: eventName,
          ...this.eventBus.createEnvelope(context, parsedResult.status, {
            stepId,
            attempt,
            reason: parsedResult.reason
          }),
          artifacts: storedArtifacts
        };

        this.eventBus.publish(eventName, envelope);
        events.push(envelope);

        stepResult = parsedResult;
        stepResults[stepId] = parsedResult;

        await this.logger.append(runId, {
          level: parsedResult.status === 'PASS' ? 'info' : 'error',
          event: 'step.completed',
          stepId,
          status: parsedResult.status,
          attempt,
          reason: parsedResult.reason,
          error: parsedResult.error
        });

        if (parsedResult.status === 'PASS') {
          if (idempotencyKey) {
            idempotencyCache.set(idempotencyKey, parsedResult);
          }
          break;
        }

        if (attempt >= retryPolicy.maxAttempts) {
          break;
        }

        const shouldRetry =
          parsedResult.status === 'RETRY' ||
          retryPolicy.retryableStatuses.includes(parsedResult.status);

        if (!shouldRetry) {
          break;
        }

        const delay = Math.min(
          retryPolicy.maxDelayMs ?? Number.MAX_SAFE_INTEGER,
          retryPolicy.baseDelayMs * Math.pow(2, attempt - 1)
        );
        await this.logger.append(runId, {
          level: 'warn',
          event: 'step.retry',
          stepId,
          attempt,
          nextDelayMs: delay
        });
        await wait(delay);
      }

      if (!stepResult || stepResult.status !== 'PASS') {
        failureStep = stepId;
      }
    }

    const finalStatus: WorkflowStatus = failureStep ? 'FAIL' : 'PASS';

    const completionEnvelope: EventEnvelope = {
      event: 'run.completed',
      ...this.eventBus.createEnvelope(context, finalStatus, {
        failedStep: failureStep
      }),
      artifacts: Object.values(runArtifacts)
    };

    this.eventBus.publish('run.completed', completionEnvelope);
    events.push(completionEnvelope);

    await this.logger.append(runId, {
      level: finalStatus === 'PASS' ? 'info' : 'error',
      event: 'run.completed',
      status: finalStatus,
      failedStep: failureStep
    });

    return {
      context,
      status: finalStatus,
      steps: stepResults,
      artifacts: runArtifacts,
      events
    };
  }

  private async validateDoD(
    dod: DoDChecklist,
    context: RunContext,
    result: StepOutput
  ): Promise<boolean> {
    for (const item of dod.items) {
      try {
        const passed = await item.validate({ context, result });
        if (!passed) {
          await this.logger.append(context.runId, {
            level: 'error',
            event: 'dod.failed',
            stepId: dod.stepId,
            checkId: item.id,
            description: item.description,
            errorMessage: item.errorMessage
          });
          return false;
        }
      } catch (error) {
        await this.logger.append(context.runId, {
          level: 'error',
          event: 'dod.error',
          stepId: dod.stepId,
          checkId: item.id,
          message: error instanceof Error ? error.message : 'Unknown DoD error'
        });
        return false;
      }
    }

    return true;
  }

  private async persistArtifacts(
    runId: string,
    stepId: string,
    artifacts: Artifact[]
  ): Promise<StoredArtifact[]> {
    if (!artifacts || artifacts.length === 0) {
      return [];
    }

    const stepDir = path.join(this.outputRoot, runId, normalizeStepId(stepId));
    await fs.mkdir(stepDir, { recursive: true });

    const stored: StoredArtifact[] = [];

    for (const artifact of artifacts) {
      const parsed = ArtifactSchema.parse(artifact);
      const artifactId = parsed.id;
      const artifactPath = path.join(stepDir, `${artifactId}.json`);
      const payload = 'data' in parsed && parsed.data !== undefined ? parsed.data : parsed;
      const hash = hashPayload(payload);

      await fs.writeFile(artifactPath, JSON.stringify(payload, null, 2), 'utf-8');

      stored.push({
        ...parsed,
        path: artifactPath,
        hash,
        data: undefined
      });
    }

    return stored;
  }

  private generateRunId(workflowId: string): string {
    return `${workflowId}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  }
}

export const createWorkflowRunManager = (
  definition: WorkflowDefinition,
  options: Omit<WorkflowRunManagerOptions, 'dag'>
): WorkflowRunManager => {
  const dag = new WorkflowDAG(definition);
  return new WorkflowRunManager({ ...options, dag });
};
