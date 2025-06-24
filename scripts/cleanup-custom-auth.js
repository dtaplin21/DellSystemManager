const fs = require('fs');
const path = require('path');

// Files and directories to remove after Supabase migration
const filesToRemove = [
  // Frontend custom auth files
  'frontend/src/hooks/use-auth.ts',
  'frontend/src/contexts/auth-context.tsx',
  'frontend/src/types/auth.ts',
  
  // Backend custom auth files
  'backend/middlewares/auth.js',
  'backend/routes/auth.js',
  'backend/utils/validate.js',
  'server/middleware/auth.ts',
  
  // Custom auth API routes
  'index.js', // Contains custom auth routes
  
  // Database migration files (after migration is complete)
  'backend/db/migrate.js',
  'backend/db/migrations/001_create_projects_and_panels.sql',
];

// Files that need to be updated to remove custom auth references
const filesToUpdate = [
  'frontend/src/app/dashboard/layout.tsx',
  'frontend/src/components/layout/navbar.tsx',
  'frontend/src/components/layout/sidebar.tsx',
  'frontend/src/app/dashboard/page.tsx',
  'frontend/src/app/dashboard/projects/page.tsx',
  'frontend/src/app/dashboard/documents/page.tsx',
  'frontend/src/app/dashboard/qc-data/page.tsx',
  'frontend/src/app/dashboard/ai/page.tsx',
  'frontend/src/app/dashboard/settings/page.tsx',
  'frontend/src/app/dashboard/profile/page.tsx',
  'frontend/src/app/dashboard/account/page.tsx',
  'frontend/src/app/dashboard/subscription/page.tsx',
  'frontend/src/components/dashboard/project-card.jsx',
  'frontend/src/components/dashboard/notification-list.tsx',
  'frontend/src/components/documents/document-list.tsx',
  'frontend/src/components/qc-data/excel-importer.tsx',
  'frontend/src/components/panel-layout/control-toolbar.tsx',
  'frontend/src/components/panels/CreatePanelModal.tsx',
  'frontend/src/components/projects/create-project-form.tsx',
  'frontend/src/components/projects/edit-project-form.tsx',
  'frontend/src/components/projects/project-form.tsx',
  'frontend/src/contexts/ProjectsProvider.tsx',
  'frontend/src/hooks/use-websocket.ts',
  'backend/services/websocket.js',
  'backend/routes/projects.js',
  'backend/routes/documents.js',
  'backend/routes/qc-data.js',
  'backend/routes/ai.js',
  'backend/routes/notifications.js',
  'backend/routes/subscription.js',
];

// Environment variables to update
const envVarsToUpdate = [
  'JWT_SECRET', // Remove - no longer needed
  'SUPABASE_URL', // Add if not present
  'SUPABASE_ANON_KEY', // Add if not present
  'SUPABASE_SERVICE_ROLE_KEY', // Add if not present
];

console.log('=== SUPABASE AUTH MIGRATION CLEANUP ===\n');

console.log('Files to REMOVE after migration:');
filesToRemove.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✓' : '✗'} ${file} ${exists ? '(EXISTS)' : '(NOT FOUND)'}`);
});

console.log('\nFiles to UPDATE to remove custom auth references:');
filesToUpdate.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✓' : '✗'} ${file} ${exists ? '(EXISTS)' : '(NOT FOUND)'}`);
});

console.log('\nEnvironment variables to update:');
envVarsToUpdate.forEach(envVar => {
  console.log(`- ${envVar}`);
});

console.log('\n=== MIGRATION STEPS ===');
console.log('1. Run database migration script');
console.log('2. Import existing users to Supabase');
console.log('3. Update frontend components to use Supabase auth');
console.log('4. Update API routes to use Supabase auth');
console.log('5. Test authentication flow');
console.log('6. Remove custom auth files');
console.log('7. Update environment variables');
console.log('8. Deploy and verify');

console.log('\n=== IMPORTANT NOTES ===');
console.log('- Backup your database before migration');
console.log('- Test in staging environment first');
console.log('- Users will need to reset passwords after migration');
console.log('- Update all API calls to include Authorization headers');
console.log('- Remove all localStorage auth token references');
console.log('- Update all useAuth() hooks to useSupabaseAuth()'); 