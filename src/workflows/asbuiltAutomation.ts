import { WorkflowDefinition } from '../contracts';
import { createAsbuiltImportStep } from '../agents/asbuiltImportAgent';
import { createDuplicateDetectionStep } from '../agents/duplicateDetectionAgent';
import { createImportAnalysisStep } from '../agents/importAnalysisAgent';
import { createHandwritingOCRStep } from '../agents/ocrAgent';

export const createAsbuiltAutomationDefinition = (): WorkflowDefinition => ({
  id: 'asbuilt-automation',
  steps: [
    createAsbuiltImportStep(),
    createDuplicateDetectionStep(),
    createImportAnalysisStep(),
    createHandwritingOCRStep()
  ]
});
