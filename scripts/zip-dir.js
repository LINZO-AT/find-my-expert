#!/usr/bin/env node
/**
 * Cross-platform directory zipper for MTA builds.
 * Usage: node zip-dir.js <source-dir> <dest-zip>
 *
 * Uses the 'archiver' npm package — pure Node.js, no shell commands.
 * Works on Windows, Linux, and macOS without native zip or /bin/sh.
 */
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const [srcDir, destZip] = process.argv.slice(2);
if (!srcDir || !destZip) {
  console.error('Usage: node zip-dir.js <source-dir> <dest-zip>');
  process.exit(1);
}

const absSrc = path.resolve(srcDir);
const absDest = path.resolve(destZip);

// Ensure source directory exists
if (!fs.existsSync(absSrc)) {
  console.error(`Source directory does not exist: ${absSrc}`);
  process.exit(1);
}

// Ensure destination directory exists
fs.mkdirSync(path.dirname(absDest), { recursive: true });

// Remove existing zip to avoid appending
if (fs.existsSync(absDest)) {
  fs.unlinkSync(absDest);
}

const output = fs.createWriteStream(absDest);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Created ${absDest} (${archive.pointer()} bytes)`);
  process.exit(0);
});

archive.on('error', (err) => {
  console.error('Failed to create zip archive:', err.message);
  process.exit(1);
});

archive.pipe(output);

// Add all files from source directory at the root of the zip
archive.directory(absSrc, false);

archive.finalize();