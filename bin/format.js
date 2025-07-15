#!/usr/bin/env node

/**
 * Doc-to-MD Format Crawler CLI
 * Professional formatting with TOC and metadata
 */

const path = require('path');
const { spawn } = require('child_process');

const binDir = __dirname;
const projectRoot = path.resolve(binDir, '..');
const tsNodePath = path.join(projectRoot, 'node_modules', '.bin', 'ts-node');
const script = path.join(projectRoot, 'src', 'format-index.ts');

const child = spawn(tsNodePath, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: projectRoot
});

child.on('close', (code) => process.exit(code));
child.on('error', (err) => {
  console.error('Failed to start doc-to-md-format:', err.message);
  process.exit(1);
});
