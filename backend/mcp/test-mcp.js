#!/usr/bin/env node

/**
 * Test MCP server functionality
 */

import { spawn } from 'child_process';
import path from 'path';

console.log('🧪 Testing MCP Server...\n');

// Test 1: Check if server starts
console.log('Test 1: Starting server...');
const serverProcess = spawn('node', ['server.js'], {
  cwd: process.cwd(),
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

// Wait for server to start
setTimeout(() => {
  if (serverOutput.includes('MCP server running') || serverError.includes('MCP server running')) {
    console.log('✅ Server started successfully');
  } else {
    console.log('❌ Server failed to start');
    console.log('Output:', serverOutput);
    console.log('Error:', serverError);
    process.exit(1);
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
    if (serverOutput.includes('tools') || serverError.includes('tools')) {
      console.log('✅ MCP request successful');
    } else {
      console.log('❌ MCP request failed');
      console.log('Output:', serverOutput);
      console.log('Error:', serverError);
    }
    
    // Clean up
    serverProcess.kill();
    console.log('\n🎉 MCP Server test completed!');
    process.exit(0);
  }, 2000);
  
}, 2000);

// Handle server errors
serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('❌ Server exited with code:', code);
    console.error('Error output:', serverError);
    process.exit(1);
  }
});
