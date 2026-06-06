#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out', 'main');
const file = path.join(outDir, 'index.js');
if (!fs.existsSync(file)) { console.log('No build output yet'); process.exit(0); }

let content = fs.readFileSync(file, 'utf-8');

// Replace entire electron require approach
const old = 'const electron = require("electron");';
const replacement = `const electron = (() => {
  const e = require("electron");
  // In Electron main process, require('electron') should return the full API.
  // If it returns a string (npm package path), the module system is shadowed.
  // As a fallback, try accessing via process.execPath relative resolution.
  if (e && e.app) return e;
  // Force re-resolve: delete from cache and retry with different path
  const rp = require.resolve("electron");
  delete require.cache[rp];
  try { const e2 = require("electron"); if (e2.app) return e2; } catch (_) {}
  return e; // Return whatever we have
})();`;

content = content.replace(old, replacement);
fs.writeFileSync(file, content, 'utf-8');
console.log('Patched electron require in main process');
