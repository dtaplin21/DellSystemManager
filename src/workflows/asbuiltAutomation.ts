import { WorkflowDefinition } from '../contracts';
import { createAsbuiltImportStep } from '../agents/asbuiltImportAgent';
import { createDuplicateDetectionStep } from '../agents/duplicateDetectionAgent';
import { createImportAnalysisStep } from '../agents/importAnalysisAgent';
import { createHandwritingOCRStep } from '../agents/ocrAgent';
import { createAsbuiltPersistenceStep } from '../agents/asbuiltPersistenceAgent';

export const createAsbuiltAutomationDefinition = (): WorkflowDefinition => ({
  id: 'asbuilt-automation',
  steps: [
    createAsbuiltImportStep(),
    createDuplicateDetectionStep(),
    createAsbuiltPersistenceStep(),
    createImportAnalysisStep(),
    createHandwritingOCRStep()
  ]
});
