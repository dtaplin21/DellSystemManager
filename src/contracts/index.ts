import { z } from 'zod';

export const STATUS_VALUES = ['PENDING', 'RUNNING', 'PASS', 'FAIL', 'RETRY', 'BLOCKED'] as const;
export const WorkflowStatusSchema = z.enum(STATUS_VALUES);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const RunContextSchema = z.object({
  runId: z.string(),
  workflow: z.string(),
  projectId: z.string(),
  userId: z.string().nullable().optional(),
  timestamp: z.string(),
  metadata: z.record(z.any()).optional().default({})
});
export type RunContext = z.infer<typeof RunContextSchema>;

export const ArtifactSchema = z.object({
  id: z.string(),
  type: z.string(),
  schemaVersion: z.string(),
  producedBy: z.string(),
  producedAt: z.string(),
  status: WorkflowStatusSchema.default('PASS'),
  path: z.string().optional(),
  hash: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  data: z.any().optional()
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const StepOutputSchema = z.object({
  status: WorkflowStatusSchema,
  attempt: z.number().int().nonnegative().default(0),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  reason: z.string().optional(),
  output: z.any().optional(),
  artifacts: z.array(ArtifactSchema).optional(),
  metrics: z.record(z.any()).optional(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    cause: z.any().optional()
  }).optional(),
  skip: z.boolean().optional()
});
export type StepOutput = z.infer<typeof StepOutputSchema>;

export const DoDItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  validate: z.custom<(
    input: { context: RunContext; result: StepOutput }
  ) => Promise<boolean> | boolean>((value) => typeof value === 'function', {
    message: 'validate must be a function'
  }),
  onFailure: WorkflowStatusSchema.optional(),
  errorMessage: z.string().optional()
});
export type DoDItem = z.infer<typeof DoDItemSchema>;

export const DoDChecklistSchema = z.object({
  stepId: z.string(),
  items: z.array(DoDItemSchema)
});
export type DoDChecklist = z.infer<typeof DoDChecklistSchema>;

export const EventEnvelopeSchema = z.object({
  event: z.string(),
  context: RunContextSchema,
  status: WorkflowStatusSchema,
  payload: z.record(z.any()).optional(),
  artifacts: z.array(ArtifactSchema).optional(),
  timestamp: z.string()
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

export const AgentExecutionInputSchema = z.object({
  context: RunContextSchema,
  input: z.any().optional(),
  attempt: z.number().int().nonnegative(),
  previousResults: z.record(StepOutputSchema).optional(),
  initialInput: z.any().optional()
});
export type AgentExecutionInput = z.infer<typeof AgentExecutionInputSchema>;

export const AgentExecutionResultSchema = z.object({
  status: WorkflowStatusSchema,
  artifacts: z.array(ArtifactSchema).optional(),
  output: z.any().optional(),
  reason: z.string().optional(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional()
  }).optional(),
  metrics: z.record(z.any()).optional()
});
export type AgentExecutionResult = z.infer<typeof AgentExecutionResultSchema>;

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().positive().default(1),
  baseDelayMs: z.number().int().nonnegative().default(1000),
  maxDelayMs: z.number().int().positive().optional(),
  retryableStatuses: z.array(WorkflowStatusSchema).default(['RETRY'])
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

export const WorkflowStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  dependsOn: z.array(z.string()).default([]),
  buildInput: z
    .custom<(
      args: {
        context: RunContext;
        previousResults: Record<string, StepOutput>;
        initialInput: any;
      }
    ) => Promise<any> | any>((value) => typeof value === 'function', {
      message: 'buildInput must be a function'
    })
    .optional(),
  idempotencyKey: z
    .custom<(
      args: {
        context: RunContext;
        input: any;
        previousResults: Record<string, StepOutput>;
        initialInput: any;
      }
    ) => Promise<string | null> | string | null>((value) =>
      value === undefined || typeof value === 'function',
    {
      message: 'idempotencyKey must be a function'
    }
    )
    .optional(),
  execute: z.custom<(
    args: {
      context: RunContext;
      input: any;
      attempt: number;
      previousResults: Record<string, StepOutput>;
      initialInput: any;
      logger: (message: string, details?: Record<string, unknown>) => Promise<void>;
    }
  ) => Promise<z.infer<typeof AgentExecutionResultSchema>>>(
    (value) => typeof value === 'function',
    { message: 'execute must be a function' }
  ),
  retryPolicy: RetryPolicySchema.optional(),
  dod: DoDChecklistSchema.optional(),
  successEvent: z.string().optional(),
  failureEvent: z.string().optional(),
  optional: z.boolean().optional()
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  steps: z.array(WorkflowStepSchema)
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
