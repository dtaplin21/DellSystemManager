import ImportAnalysisService from '../../backend/services/importAnalysisService';
import { DoDChecklist, WorkflowStep } from '../contracts';

export const createImportAnalysisStep = (): WorkflowStep => {
  const service = new ImportAnalysisService();

  const dod: DoDChecklist = {
    stepId: 'import.analysis',
    items: [
      {
        id: 'summary-present',
        description: 'AI summary must be available',
        validate: async ({ result }) => typeof result.output?.summary === 'string'
      }
    ]
  };

  return {
    id: 'import.analysis',
    description: 'Generate comprehensive import analysis and recommendations',
    dependsOn: ['asbuilt.import', 'asbuilt.duplicateDetection'],
    successEvent: 'import.ready',
    retryPolicy: {
      maxAttempts: 2,
      baseDelayMs: 2000,
      retryableStatuses: ['RETRY']
    },
    buildInput: async ({ previousResults }) => {
      const importOutput = previousResults['asbuilt.import']?.output as
        | Record<string, any>
        | undefined;
      const duplicateOutput = previousResults['asbuilt.duplicateDetection']?.output as
        | Record<string, any>
        | undefined;

      if (!importOutput || !duplicateOutput) {
        throw new Error('Upstream results missing for import analysis');
      }

      const duplicateDetails = duplicateOutput.duplicates ?? {};

      return {
        records: importOutput.records ?? [],
        duplicates: duplicateDetails.duplicates ?? [],
        conflicts: duplicateDetails.conflicts ?? [],
        panels: importOutput.records ?? [],
        fileMetadata: {
          detectedDomain: importOutput.detectedDomain,
          aiConfidence: importOutput.aiConfidence
        },
        duplicateSummary: duplicateDetails.summary,
        similarity: duplicateOutput.similarity
      };
    },
    execute: async ({ input }) => {
      try {
        const result = await service.analyzeImportResults(input);
        return {
          status: 'PASS' as const,
          output: result,
          artifacts: [
            {
              id: 'import.analyzed',
              type: 'import.analyzed',
              status: 'PASS' as const,
              schemaVersion: '1.0.0',
              producedBy: 'import.analysis',
              producedAt: new Date().toISOString(),
              data: result,
              metadata: {
                model: result.model,
                generatedAt: result.generatedAt
              }
            }
          ]
        };
      } catch (error) {
        return {
          status: 'FAIL' as const,
          error: {
            message: error instanceof Error ? error.message : 'Import analysis failed',
            stack: error instanceof Error ? error.stack : undefined
          }
        };
      }
    },
    dod
  };
};
