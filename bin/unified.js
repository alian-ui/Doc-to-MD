#!/usr/bin/env node

/**
 * Doc-to-MD Unified Interface CLI
 * Intelligent crawler selection with automatic website analysis
 */

const path = require('path');
const { spawn } = require('child_process');

const binDir = __dirname;
const projectRoot = path.resolve(binDir, '..');
const tsNodePath = path.join(projectRoot, 'node_modules', '.bin', 'ts-node');
const script = path.join(projectRoot, 'src', 'unified-index.ts');

const child = spawn(tsNodePath, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: projectRoot
});

child.on('close', (code) => process.exit(code));
child.on('error', (err) => {
  console.error('Failed to start doc-to-md-unified:', err.message);
  process.exit(1);
});
