import fs from 'fs/promises';
import path from 'path';
import HandwritingOCRService from '../../backend/services/handwriting-ocr';
import { DoDChecklist, WorkflowStep } from '../contracts';

export const createHandwritingOCRStep = (): WorkflowStep => {
  const service = new HandwritingOCRService();

  const dod: DoDChecklist = {
    stepId: 'ocr.extract',
    items: [
      {
        id: 'text-present',
        description: 'OCR result must include extracted text or structured payload',
        validate: async ({ result }) => Boolean(result.output)
      }
    ]
  };

  return {
    id: 'ocr.extract',
    description: 'Extract handwritten QC data using OCR',
    dependsOn: [],
    optional: true,
    successEvent: 'qc.validated',
    retryPolicy: {
      maxAttempts: 2,
      baseDelayMs: 3000,
      retryableStatuses: ['RETRY']
    },
    buildInput: async ({ initialInput }) => {
      if (!initialInput?.handwrittenFilePath) {
        return null;
      }
      return {
        filePath: initialInput.handwrittenFilePath,
        mimeType: initialInput.handwrittenMimeType ?? 'application/pdf'
      };
    },
    execute: async ({ input }) => {
      if (!input) {
        return {
          status: 'PASS' as const,
          output: null,
          reason: 'No handwritten input provided'
        };
      }

      try {
        const buffer = await fs.readFile(input.filePath as string);
        const mimeType = input.mimeType as string;
        const result = await service.extractTextFromFile(buffer, mimeType);

        return {
          status: 'PASS' as const,
          output: result,
          artifacts: [
            {
              id: 'qc.ocr',
              type: 'qc.ocr',
              status: 'PASS' as const,
              schemaVersion: '1.0.0',
              producedBy: 'ocr.extract',
              producedAt: new Date().toISOString(),
              data: result,
              metadata: {
                mimeType,
                fileName: path.basename(input.filePath as string)
              }
            }
          ]
        };
      } catch (error) {
        return {
          status: 'FAIL' as const,
          error: {
            message: error instanceof Error ? error.message : 'OCR extraction failed',
            stack: error instanceof Error ? error.stack : undefined
          }
        };
      }
    },
    dod
  };
};
