import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  EventEnvelope,
  EventEnvelopeSchema,
  RunContext,
  WorkflowStatus
} from '../contracts';

type EventHandler = (payload: EventEnvelope) => Promise<void> | void;

export interface EventBusOptions {
  schemas?: Record<string, z.ZodType<EventEnvelope>>;
  onError?: (error: unknown, event: string, payload: unknown) => void;
}

export class TypedEventBus {
  private readonly emitter: EventEmitter;
  private readonly schemas: Map<string, z.ZodType<EventEnvelope>>;
  private readonly onError?: (error: unknown, event: string, payload: unknown) => void;

  constructor(options: EventBusOptions = {}) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.schemas = new Map(Object.entries(options.schemas ?? {}));
    this.onError = options.onError;
  }

  registerSchema(event: string, schema: z.ZodType<EventEnvelope>): void {
    this.schemas.set(event, schema);
  }

  publish(event: string, payload: Omit<EventEnvelope, 'event'>): void {
    const schema = this.schemas.get(event) ?? EventEnvelopeSchema;
    const parsed = schema.parse({ ...payload, event });
    this.emitter.emit(event, parsed);
  }

  subscribe(event: string, handler: EventHandler): () => void {
    const wrapped: EventHandler = async (payload) => {
      try {
        await handler(payload);
      } catch (error) {
        if (this.onError) {
          this.onError(error, event, payload);
        } else {
          // eslint-disable-next-line no-console
          console.error(`[EventBus] handler error for ${event}:`, error);
        }
      }
    };

    this.emitter.on(event, wrapped);
    return () => {
      this.emitter.off(event, wrapped);
    };
  }

  once(event: string, handler: EventHandler): () => void {
    const wrapped: EventHandler = async (payload) => {
      try {
        await handler(payload);
      } catch (error) {
        if (this.onError) {
          this.onError(error, event, payload);
        } else {
          // eslint-disable-next-line no-console
          console.error(`[EventBus] handler error for ${event}:`, error);
        }
      }
    };

    this.emitter.once(event, wrapped);
    return () => {
      this.emitter.off(event, wrapped);
    };
  }

  createEnvelope(
    context: RunContext,
    status: WorkflowStatus,
    payload?: Record<string, unknown>
  ): Omit<EventEnvelope, 'event'> {
    return {
      context,
      status,
      payload,
      timestamp: new Date().toISOString()
    };
  }
}

export const createEventBus = (options?: EventBusOptions): TypedEventBus =>
  new TypedEventBus(options);
