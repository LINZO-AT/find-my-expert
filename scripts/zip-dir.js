#!/usr/bin/env node
/**
 * Cross-platform directory zipper for MTA builds.
 * Usage: node zip-dir.js <source-dir> <dest-zip>
 *
 * Tries native `zip` first (Linux/macOS), falls back to `bestzip` (Windows).
 * Both are invoked with explicit cwd to avoid path resolution issues.
 */
const { spawnSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const [srcDir, destZip] = process.argv.slice(2);
if (!srcDir || !destZip) {
  console.error('Usage: node zip-dir.js <source-dir> <dest-zip>');
  process.exit(1);
}

const absSrc = path.resolve(srcDir);
const absDest = path.resolve(destZip);

// Ensure destination directory exists
fs.mkdirSync(path.dirname(absDest), { recursive: true });

// Remove existing zip to avoid appending
if (fs.existsSync(absDest)) {
  fs.unlinkSync(absDest);
}

// Try native zip first (available on Linux/macOS)
const zipResult = spawnSync('zip', ['-r', absDest, '.'], {
  cwd: absSrc,
  stdio: 'inherit'
});

if (zipResult.status === 0) {
  console.log(`Created ${absDest}`);
  process.exit(0);
}

// Fallback: use bestzip with explicit cwd (for Windows / no native zip)
console.log('Native zip not available, falling back to bestzip...');
try {
  execSync(`npx -y bestzip "${absDest}" .`, {
    cwd: absSrc,
    stdio: 'inherit',
    shell: true
  });
  console.log(`Created ${absDest}`);
} catch (err) {
  console.error('Failed to create zip archive:', err.message);
  process.exit(1);
}