const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'out', 'main', 'index.js');
if (!fs.existsSync(file)) { console.log('No build output'); process.exit(1); }

let c = fs.readFileSync(file, 'utf-8');

// The core issue: const electron = require("electron") returns npm path string
// on this macOS version. Fix: wrap ALL electron property access through
// a Proxy that checks once per access cycle.
// 
// Replace the top-level require with our bootstrapper.
const oldRequire = 'const electron = require("electron");';

const bootstrapper = `let ___el;
function getElectronAPI() {
  if (___el && ___el.app) return ___el;
  const raw = require("electron");
  if (raw && raw.app) { ___el = raw; return raw; }
  // macOS Electron bug: npm shadowed built-in module.
  // Access internal electron bindings.
  // The built-in module lives at a known internal path.
  try {
    const m = require("module");
    // Try to load Electron's internal representation
    const p = require.resolve("electron");
    // Bypass npm cache and force Electron's built-in resolution
    const orig = m._resolveFilename;
    const hacked = function(request, parent, isMain, options) {
      if (request === "electron") {
        // Return a special path that Electron recognizes
        return "electron";
      }
      return orig.apply(this, arguments);
    };
    m._resolveFilename = hacked;
    try {
      ___el = require("electron");
    } finally {
      m._resolveFilename = orig;
    }
    if (___el && ___el.app) return ___el;
  } catch(e) {}
  // Last resort: proxy object that forwards to raw string
  return new Proxy(raw, {
    get(target, prop) {
      if (getElectronAPI() !== raw) return getElectronAPI()[prop];
      return target[prop];
    }
  });
}
const electron = getElectronAPI();`;

c = c.replace(oldRequire, bootstrapper);
fs.writeFileSync(file, c);
console.log('Patched:', file);
