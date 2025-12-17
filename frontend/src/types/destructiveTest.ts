// Destructive Test Type Definition
// Destructive tests are distinct from Panels and Patches

export interface DestructiveTest {
  id: string;
  x: number; // World units (feet) - real measurements
  y: number; // World units (feet) - real measurements
  width: number; // World units (feet) - rectangle
  height: number; // World units (feet) - rectangle
  rotation: number; // Rotation in degrees
  isValid: boolean;
  sampleId: string; // D-{number} format
  date: string;
  testResult?: 'pass' | 'fail' | 'pending';
  notes?: string;
  location?: string;
  color?: string;
  fill?: string;
  material?: string;
  thickness?: number;
  meta?: {
    testData?: any;
  };
  asbuiltRecordId?: string; // Link to the form that created this destructive test
  panelId?: string; // Link to panel if destructive test is associated with a panel
}

// Utility function to create a destructive test
export function createDestructiveTest(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  sampleId?: string
): DestructiveTest {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    isValid: true,
    sampleId: sampleId || `D-${id.slice(0, 8)}`,
    date: new Date().toISOString().slice(0, 10),
    testResult: 'pending',
    fill: '#f59e0b', // Orange/amber color to distinguish
    color: '#d97706',
  };
}

// Validation function
export function validateDestructiveTest(test: any): test is DestructiveTest {
  return (
    test &&
    typeof test.id === 'string' &&
    typeof test.x === 'number' &&
    typeof test.y === 'number' &&
    typeof test.width === 'number' &&
    typeof test.height === 'number' &&
    typeof test.rotation === 'number' &&
    typeof test.isValid === 'boolean' &&
    typeof test.sampleId === 'string' &&
    test.width > 0 &&
    test.height > 0 &&
    /^D-\d+$/.test(test.sampleId) // Validate D-{number} format
  );
}

// Destructive test layout interface
export interface DestructiveTestLayout {
  id: string;
  projectId: string;
  destructiveTests: DestructiveTest[];
  createdAt?: string;
  updatedAt?: string;
}

