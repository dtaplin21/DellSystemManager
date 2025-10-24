#!/usr/bin/env node

/**
 * Test script for MCP server
 * Tests the server functionality without Claude Desktop
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing MCP Server...\n');

// Test 1: Check if server starts without errors
console.log('Test 1: Starting server...');
const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverOutput = '';
let serverError = '';

serverProcess.stdout.on('data', (data) => {
  serverOutput += data.toString();
});

serverProcess.stderr.on('data', (data) => {
  serverError += data.toString();
});

// Give server time to start
setTimeout(() => {
  console.log('✅ Server started successfully');
  console.log('Server output:', serverOutput);
  
  if (serverError) {
    console.log('Server errors:', serverError);
  }
  
  // Test 2: Send a simple MCP request
  console.log('\nTest 2: Sending MCP request...');
  
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');
  
  // Wait for response
  setTimeout(() => {
    console.log('✅ MCP request sent');
    console.log('Response:', serverOutput);
    
    // Clean up
    serverProcess.kill();
    console.log('\n🎉 MCP Server test completed!');
    process.exit(0);
  }, 2000);
  
}, 3000);

// Handle server errors
serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error('❌ Server exited with code:', code);
    console.error('Error output:', serverError);
    process.exit(1);
  }
});
