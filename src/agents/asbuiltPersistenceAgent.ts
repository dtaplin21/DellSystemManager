import AsbuiltService from '../../backend/services/asbuiltService';
import { DoDChecklist, WorkflowStep } from '../contracts';

interface PersistOutput {
  attempted: number;
  persisted: number;
  reused: number;
  recordIds: string[];
  reusedRecordIds: string[];
}

const isValidUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

const sortForCanonicalJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortForCanonicalJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortForCanonicalJson((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
};

const canonicalize = (value: unknown): string =>
  JSON.stringify(sortForCanonicalJson(value));

export const createAsbuiltPersistenceStep = (): WorkflowStep => {
  const dod: DoDChecklist = {
    stepId: 'asbuilt.persist',
    items: [
      {
        id: 'records-persisted',
        description: 'Records with panel IDs must be stored when available',
        validate: async ({ result }) => {
          const output = result.output as PersistOutput | undefined;
          if (!output) return false;
          if (output.attempted === 0) return true;
          const totalStored = (output.persisted ?? 0) + (output.reused ?? 0);
          return totalStored > 0 && totalStored <= output.attempted;
        }
      }
    ]
  };

  return {
    id: 'asbuilt.persist',
    description: 'Persist imported as-built records into the database',
    dependsOn: ['asbuilt.import', 'asbuilt.duplicateDetection'],
    successEvent: 'asbuilt.persisted',
    retryPolicy: {
      maxAttempts: 2,
      baseDelayMs: 2000,
      retryableStatuses: ['RETRY']
    },
    buildInput: async ({ previousResults }) => {
      const importResult = previousResults['asbuilt.import']?.output as
        | {
            records?: Array<Record<string, unknown>>;
          }
        | undefined;

      return importResult ?? { records: [] };
    },
    execute: async ({ context, input, initialInput, previousResults }) => {
      const records = (input?.records as Array<Record<string, any>>) ?? [];

      if (!records.length) {
        return {
          status: 'PASS' as const,
          output: {
            attempted: 0,
            persisted: 0,
            reused: 0,
            recordIds: [],
            reusedRecordIds: []
          }
        };
      }

      const asbuiltService = new AsbuiltService();
      const recordIds: string[] = [];
      const reusedRecordIds: string[] = [];
      let persisted = 0;
      let reused = 0;
      const sourceDocRaw = initialInput?.fileId as string | undefined;
      const sourceDocId = sourceDocRaw && isValidUuid(sourceDocRaw) ? sourceDocRaw : null;
      const createdBy = isValidUuid(context.userId) ? context.userId : null;

      try {
        for (const record of records) {
          try {
            if (!record.panelId) {
              continue;
            }

            const rawDataPayload = canonicalize(record.rawData ?? {});
            const existingRecord = await asbuiltService.findRecordByRawData({
              projectId: context.projectId,
              panelId: record.panelId,
              domain: record.domain,
              rawData: rawDataPayload
            });

            if (existingRecord?.id) {
              reused += 1;
              reusedRecordIds.push(existingRecord.id);
              continue;
            }

            const created = await asbuiltService.createRecord({
              ...record,
              projectId: context.projectId,
              sourceDocId,
              createdBy
            });

            if (created?.id) {
              recordIds.push(created.id);
              persisted += 1;
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[AsbuiltPersist] Failed to persist record', {
              panelId: record.panelId,
              error: error instanceof Error ? error.message : error
            });
          }
        }
      } finally {
        await asbuiltService.close().catch(() => undefined);
      }

      const duplicateSummary = previousResults['asbuilt.duplicateDetection']?.output?.duplicateSummary;
      const duplicatePanels: string[] = duplicateSummary?.duplicatePanels ?? [];

      return {
        status: 'PASS' as const,
        output: {
          attempted: records.length,
          persisted,
          reused,
          recordIds,
          reusedRecordIds,
          duplicatePanels
        }
      };
    },
    dod
  };
};
