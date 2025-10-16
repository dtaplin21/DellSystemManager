import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import AsbuiltImportAI from '../../backend/services/asbuiltImportAI';
import { DoDChecklist, WorkflowStep } from '../contracts';

const hashFile = async (filePath: string): Promise<string> => {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const createAsbuiltImportStep = (): WorkflowStep => {
  const dod: DoDChecklist = {
    stepId: 'asbuilt.import',
    items: [
      {
        id: 'import-success',
        description: 'Import must succeed and report success flag',
        validate: async ({ result }) => Boolean(result.output?.success)
      },
      {
        id: 'records-parsed',
        description: 'Records array must be present',
        validate: async ({ result }) => Array.isArray(result.output?.records)
      }
    ]
  };

  return {
    id: 'asbuilt.import',
    description: 'Parse as-built Excel and normalize records',
    dependsOn: [],
    successEvent: 'document.ingested',
    retryPolicy: {
      maxAttempts: 2,
      baseDelayMs: 2000,
      retryableStatuses: ['RETRY', 'FAIL']
    },
    idempotencyKey: async ({ input }) => {
      const excelPath = input?.excelPath as string | undefined;
      if (!excelPath) {
        return null;
      }
      const hash = await hashFile(excelPath);
      return `${hash}:${input?.domain ?? 'auto'}`;
    },
    buildInput: async ({ initialInput }) => {
      if (!initialInput?.excelPath) {
        throw new Error('excelPath is required to run the as-built import step');
      }
      return initialInput;
    },
    execute: async ({ context, input }) => {
      const excelPath = input?.excelPath as string;
      const domain = (input?.domain as string | undefined) ?? undefined;
      const fileName = (input?.fileName as string | undefined) ?? path.basename(excelPath);
      const fileBuffer = await fs.readFile(excelPath);
      const service = new AsbuiltImportAI();

      try {
        const result = await service.importExcelData(
          fileBuffer,
          context.projectId,
          domain,
          context.userId ?? 'system',
          {
            fileName,
            fileId: input?.fileId as string | undefined
          }
        );

        return {
          status: 'PASS' as const,
          output: result,
          artifacts: [
            {
              id: 'asbuilt.parsed',
              type: 'asbuilt.parsed',
              status: 'PASS' as const,
              schemaVersion: '1.0.0',
              producedBy: 'asbuilt.import',
              producedAt: new Date().toISOString(),
              data: result,
              metadata: {
                domain: result.detectedDomain,
                recordCount: result.records?.length ?? 0,
                duplicateCount: result.duplicates?.length ?? 0
              }
            }
          ]
        };
      } catch (error) {
        return {
          status: 'FAIL' as const,
          error: {
            message: error instanceof Error ? error.message : 'Unknown import error',
            stack: error instanceof Error ? error.stack : undefined
          }
        };
      } finally {
        await service.close().catch(() => undefined);
      }
    },
    dod
  };
};
