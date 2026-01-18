#!/usr/bin/env node

/**
 * Project Cleanup Script
 * Removes temporary, diagnostic, and outdated files while preserving important documentation
 */

const fs = require('fs');
const path = require('path');

const filesToDelete = [
  // Root level diagnostic files
  '500_ERROR_FIX.md',
  'AI_SERVICE_404_FIX.md',
  'AI_SERVICE_500_ERROR_DEBUG.md',
  'AUTHENTICATION_LAYER2_DIAGNOSIS.md',
  'BACKEND_DATABASE_TIMEOUT_DIAGNOSIS.md',
  'BROWSER_NAVIGATE_FAILURE_DIAGNOSIS.md',
  'BROWSER_TOOLS_PROCESS_FIX.md',
  'CANVAS_ERROR_DIAGNOSIS.md',
  'COMPREHENSIVE_DB_DIAGNOSIS_REPORT.md',
  'DIAGNOSTIC_SUMMARY.md',
  'ERROR_ANALYSIS_LOGS_18-1013.md',
  'EVENT_LOOP_FIX_IMPLEMENTED.md',
  'GPT35_DIAGNOSIS.md',
  'PYDANTIC_SCHEMA_DIAGNOSIS.md',
  'PYDANTIC_SCHEMA_VERIFICATION.md',
  'UPLOAD_BUTTON_DIAGNOSIS.md',
  'WHY_FIREWALL_BLOCKING_TODAY.md',
  
  // Temporary/broken files
  'index-broken.js',
  'index.js.broken',
  'fix-local-server.js',
  'local-test.js',
  'test-ai-analysis.js',
  'test-complete-workflow.js',
  'test-enhanced-import.js',
  'test-handwriting-debug.js',
  'test-token-refresh.js',
  'cookies.txt',
  'env.test',
  'dump.rdb',
  'firewall-rules.txt',
  'vscode-server.js',
  
  // Log files
  'backend/server.log',
  'backend/server-startup.log',
  'frontend/server.log',
  
  // Project tree files
  'PROJECT_TREE_FORMATTED.txt',
  'PROJECT_TREE.txt',
  
  // Implementation summaries (outdated)
  'AGENT_UTILIZATION_COMPARISON.md',
  'BROWSER_AUTOMATION_IMPLEMENTATION_PLAN.md',
  'DESKTOP_APP_RESTRUCTURE_PLAN.md',
  'DESKTOP_CONSTRUCTION_APP_IMPLEMENTATION.md',
  'JOB_QUEUE_IMPLEMENTATION.md',
  'MULTI_AGENT_BROWSER_TOOLS_IMPLEMENTATION.md',
  'STANDALONE_CSS_REFACTORING_SUMMARY.md',
  'TIMEOUT_RETRY_IMPLEMENTATION.md',
  'WINDOWS_COMPATIBILITY_IMPLEMENTATION.md',
  
  // Backend test scripts (should be in tests/)
  'backend/test-projects-endpoints.js',
  'backend/test-document-service-version.js',
  'backend/test-document-service.js',
  'backend/test-pdf-extraction.js',
  'backend/check-database-columns.js',
  'backend/check-database.js',
  'backend/check-user.js',
  'backend/make-admin.js',
  'backend/reset-password.js',
  
  // AI service fix docs
  'ai_service/DEPENDENCY_FIX_EXPLANATION.md',
  'ai_service/REQUIREMENTS_FIX_SUMMARY.md',
  'ai_service/CACHE_CLEARING_QUICK_REFERENCE.md',
  'ai_service/PROJECT_TREE.txt',
  
  // Mobile app fix docs
  'mobile/ios/GeoSynthQC/FIX_UIKIT_ERROR.md',
  'mobile/ios/GeoSynthQC/FIX_DUPLICATE_ERROR.md',
  'mobile/ios/GeoSynthQC/IMPLEMENTATION_COMPLETE.md',
  'mobile/ios/GeoSynthQC/IMPLEMENTATION_SUMMARY.md',
  'mobile/ios/GeoSynthQC/IMPLEMENTATION_STATUS.md',
  'mobile/ios/GeoSynthQC/NEXT_STEPS.md',
  'mobile/ios/GeoSynthQC/ADD_INFO_PLIST_KEYS_ALTERNATIVE.md',
];

const directoriesToDelete = [
  'ai-service.archived',
  'attached_assets',
  'temp-hooks',
];

const directoriesToClean = [
  'out',
  'dist',
  'logs',
  'backend/logs',
  'backend/out',
  'backend/uploads',
  'uploaded_documents',
  'playwright-report',
  'test-results',
];

function deleteFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log(`✅ Deleted: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting ${filePath}:`, error.message);
      return false;
    }
  } else {
    console.log(`⚠️  Not found: ${filePath}`);
    return false;
  }
}

function deleteDirectory(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`✅ Deleted directory: ${dirPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting directory ${dirPath}:`, error.message);
      return false;
    }
  } else {
    console.log(`⚠️  Directory not found: ${dirPath}`);
    return false;
  }
}

function cleanDirectory(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  if (fs.existsSync(fullPath)) {
    try {
      const files = fs.readdirSync(fullPath);
      if (files.length === 0) {
        fs.rmdirSync(fullPath);
        console.log(`✅ Cleaned empty directory: ${dirPath}`);
      } else {
        // Delete all files in directory
        files.forEach(file => {
          const filePath = path.join(fullPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(fullPath);
        console.log(`✅ Cleaned directory: ${dirPath}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Error cleaning directory ${dirPath}:`, error.message);
      return false;
    }
  } else {
    console.log(`⚠️  Directory not found: ${dirPath}`);
    return false;
  }
}

function main() {
  console.log('🧹 Starting project cleanup...\n');
  
  let deletedFiles = 0;
  let deletedDirs = 0;
  let cleanedDirs = 0;
  
  // Delete files
  console.log('📄 Deleting files...');
  filesToDelete.forEach(file => {
    if (deleteFile(file)) {
      deletedFiles++;
    }
  });
  
  // Delete directories
  console.log('\n📁 Deleting directories...');
  directoriesToDelete.forEach(dir => {
    if (deleteDirectory(dir)) {
      deletedDirs++;
    }
  });
  
  // Clean directories (remove contents)
  console.log('\n🧼 Cleaning directories...');
  directoriesToClean.forEach(dir => {
    if (cleanDirectory(dir)) {
      cleanedDirs++;
    }
  });
  
  console.log('\n✨ Cleanup complete!');
  console.log(`   - Deleted ${deletedFiles} files`);
  console.log(`   - Deleted ${deletedDirs} directories`);
  console.log(`   - Cleaned ${cleanedDirs} directories`);
}

main();

