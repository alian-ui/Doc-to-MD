#!/usr/bin/env node

/**
 * Doc-to-MD CLI Entry Point
 * Main command that routes to the unified interface (recommended)
 */

const path = require('path');
const { spawn } = require('child_process');

// Get the directory containing this script
const binDir = __dirname;
const projectRoot = path.resolve(binDir, '..');

// Run the unified interface (latest and most intelligent)
const tsNodePath = path.join(projectRoot, 'node_modules', '.bin', 'ts-node');
const unifiedScript = path.join(projectRoot, 'src', 'unified-index.ts');

// Pass all arguments to the unified interface
const args = process.argv.slice(2);

const child = spawn(tsNodePath, [unifiedScript, ...args], {
  stdio: 'inherit',
  cwd: projectRoot
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start doc-to-md:', err.message);
  process.exit(1);
});
