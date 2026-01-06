/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  admin: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  },
  // Add more test users as needed
};

export const testProjects = {
  valid: {
    name: `Test Project ${Date.now()}`,
    description: 'Test project description for E2E testing',
    location: 'Test Location',
    status: 'active' as const,
  },
  minimal: {
    name: `Minimal Project ${Date.now()}`,
  },
};

export const testDocuments = {
  pdf: {
    name: 'test-document.pdf',
    type: 'application/pdf',
    // In real tests, you'd provide a path to a test file
  },
  excel: {
    name: 'test-data.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

export const testAsbuiltData = {
  valid: {
    panelNumber: 'P-001',
    location: 'North Section',
    date: new Date().toISOString().split('T')[0],
    notes: 'Test as-built entry',
  },
};

export const testPanelLayout = {
  valid: {
    panels: [
      {
        id: 'panel-1',
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        rotation: 0,
      },
    ],
  },
};

export const testAIData = {
  documents: {
    pdf: {
      path: '../../backend/test-document.pdf',
      type: 'application/pdf'
    },
    qc: {
      path: '../../backend/test-qc-document.pdf',
      type: 'application/pdf'
    }
  },
  images: {
    form: '../../backend/test-form-image.jpg',
    defect: '../../backend/test-defect-image.jpg',
    clean: '../../backend/test-clean-image.jpg'
  },
  panels: {
    sample: [
      {
        id: 'P001',
        width: 40,
        height: 100,
        x: 0,
        y: 0,
        rotation: 0
      },
      {
        id: 'P002',
        width: 40,
        height: 100,
        x: 50,
        y: 0,
        rotation: 0
      }
    ]
  },
  workflows: {
    newProject: 'new_project_setup',
    panelOptimization: 'panel_optimization',
    formReview: 'form_review_and_placement'
  }
};

