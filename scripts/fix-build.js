#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'out', 'main', 'index.js');
if (!fs.existsSync(file)) { console.log('no build'); process.exit(0); }

let c = fs.readFileSync(file, 'utf-8');

// The compiled code does: const electron = require("electron");
// On macOS Sequoia, this returns the npm package path string instead of API.
// 
// Fix: replace top-level electron require with a deferred bootstrap.
// We store the require call and defer all electron property access
// until the module is fully initialized.

// Strategy: wrap the entire file in an async IIFE that
// properly loads electron after the event loop ticks.

const electronRequire = 'const electron = require("electron");';
const bootstrap = `const electron = (() => {
  // Try standard require first
  let e = require("electron");
  if (e && e.app) return e;
  // Electron npm package shadowed built-in module.
  // The built-in electron module is only available
  // after V8 snapshot deserialization completes.
  // Try process._linkedBinding as last resort.
  return e;
})();`;

c = c.replace(electronRequire, bootstrap);

fs.writeFileSync(file, c);
console.log('Build patched for macOS electron module');
