import DuplicateDetectionService from '../../backend/services/duplicateDetectionService';
import { DoDChecklist, WorkflowStep } from '../contracts';

export const createDuplicateDetectionStep = (): WorkflowStep => {
  const service = new DuplicateDetectionService();

  const dod: DoDChecklist = {
    stepId: 'asbuilt.duplicateDetection',
    items: [
      {
        id: 'analysis-generated',
        description: 'Duplicate analysis must include a summary payload',
        validate: async ({ result }) => Boolean(result.output?.duplicateSummary)
      }
    ]
  };

  return {
    id: 'asbuilt.duplicateDetection',
    description: 'Run duplicate detection and similarity analysis on imported records',
    dependsOn: ['asbuilt.import'],
    successEvent: 'asbuilt.validated',
    retryPolicy: {
      maxAttempts: 2,
      baseDelayMs: 2000,
      retryableStatuses: ['RETRY']
    },
    buildInput: async ({ previousResults }) => {
      const importResult = previousResults['asbuilt.import']?.output as
        | {
            records?: Array<{ mappedData?: { panelNumber?: string } }>;
            detectedDomain?: string;
          }
        | undefined;

      if (!importResult) {
        throw new Error('As-built import results not available for duplicate detection');
      }

      return importResult;
    },
    execute: async ({ context, input }) => {
      const records = input?.records ?? [];
      const domain = input?.detectedDomain as string | undefined;
      const panelNumbers = records
        .map((record: any) => record?.mappedData?.panelNumber)
        .filter(Boolean);

      try {
        const duplicates = await service.checkForDuplicates(
          context.projectId,
          panelNumbers,
          domain ?? 'panel_placement'
        );

        const similarity = await service.detectSimilarRecords(
          context.projectId,
          records,
          domain ?? 'panel_placement'
        );

        const output = {
          duplicateSummary: duplicates.summary,
          duplicates,
          similarity
        };

        return {
          status: 'PASS' as const,
          output,
          artifacts: [
            {
              id: 'asbuilt.de-duplicated',
              type: 'asbuilt.deduplicated',
              schemaVersion: '1.0.0',
              producedBy: 'asbuilt.duplicateDetection',
              producedAt: new Date().toISOString(),
              data: output,
              metadata: {
                duplicateCount: duplicates.duplicates?.length ?? 0,
                conflictCount: duplicates.conflicts?.length ?? 0
              }
            }
          ]
        };
      } catch (error) {
        return {
          status: 'FAIL' as const,
          error: {
            message:
              error instanceof Error ? error.message : 'Duplicate detection failed',
            stack: error instanceof Error ? error.stack : undefined
          }
        };
      }
    },
    dod
  };
};
