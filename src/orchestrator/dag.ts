import { WorkflowDefinition, WorkflowDefinitionSchema, WorkflowStep, WorkflowStepSchema } from '../contracts';

export class WorkflowDAG {
  private readonly id: string;
  private readonly steps: Map<string, WorkflowStep> = new Map();

  constructor(definition: WorkflowDefinition) {
    const parsed = WorkflowDefinitionSchema.parse(definition);
    this.id = parsed.id;
    parsed.steps.forEach((step) => {
      if (this.steps.has(step.id)) {
        throw new Error(`Duplicate step id detected: ${step.id}`);
      }
      this.steps.set(step.id, step);
    });
    this.validateDependencies();
  }

  private validateDependencies(): void {
    const order = this.getExecutionOrder();
    if (order.length !== this.steps.size) {
      throw new Error('Dependency resolution failed: cycle detected or missing steps');
    }
  }

  getId(): string {
    return this.id;
  }

  getStep(stepId: string): WorkflowStep {
    const step = this.steps.get(stepId);
    if (!step) {
      throw new Error(`Unknown step id: ${stepId}`);
    }
    return WorkflowStepSchema.parse(step);
  }

  getSteps(): WorkflowStep[] {
    return Array.from(this.steps.values()).map((step) => WorkflowStepSchema.parse(step));
  }

  getExecutionOrder(): string[] {
    const inDegree: Record<string, number> = {};
    const adjacency: Record<string, string[]> = {};

    for (const step of this.steps.values()) {
      inDegree[step.id] = inDegree[step.id] ?? 0;
      adjacency[step.id] = adjacency[step.id] ?? [];
      step.dependsOn?.forEach((dependency) => {
        if (!this.steps.has(dependency)) {
          throw new Error(`Step ${step.id} depends on unknown step ${dependency}`);
        }
        adjacency[dependency] = adjacency[dependency] ?? [];
        adjacency[dependency].push(step.id);
        inDegree[step.id] = (inDegree[step.id] ?? 0) + 1;
      });
    }

    const queue = Object.keys(inDegree).filter((id) => inDegree[id] === 0);
    const order: string[] = [];

    while (queue.length) {
      const node = queue.shift();
      if (!node) {
        break;
      }
      order.push(node);
      for (const neighbor of adjacency[node] ?? []) {
        inDegree[neighbor] -= 1;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    return order;
  }
}
