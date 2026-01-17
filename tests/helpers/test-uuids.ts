/**
 * Valid UUID constants for testing
 * Use these when you need a valid UUID format but don't need a real database record
 * 
 * Note: These are valid UUID formats but may not exist in the database.
 * For tests that require actual database records, use ProjectHelpers.getFirstProjectId()
 */
export const TEST_UUIDS = {
  // Test project IDs (valid UUID format, but may not exist in DB)
  PROJECT: '00000000-0000-0000-0000-000000000001',
  PROJECT_2: '00000000-0000-0000-0000-000000000002',
  
  // Test user IDs
  USER: '00000000-0000-0000-0000-000000000010',
  
  // Test form IDs
  FORM: '00000000-0000-0000-0000-000000000020',
  
  // Test document IDs
  DOCUMENT: '00000000-0000-0000-0000-000000000030',
} as const;

/**
 * Generate a random valid UUID for testing
 * Useful when you need unique IDs per test run
 */
export function generateTestUUID(): string {
  // Use Node.js built-in crypto.randomUUID if available (Node 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: Use uuid package if available
  try {
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  } catch {
    // Last resort: Generate a simple valid UUID format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

