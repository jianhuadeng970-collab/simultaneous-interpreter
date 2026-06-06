/**
 * electron-builder afterPack hook.
 * Strips duplicated files from app.asar to reduce installed disk size:
 *   - models/ (~430MB) — already in resources/models via extraResources
 *   - server/, src/, config files (~5MB) — not needed at runtime
 *   - Unused Chromium locales (~38MB) — keep only en-US + zh-CN
 */
const { execSync } = require('child_process')
const { existsSync, readdirSync, unlinkSync } = require('fs')
const { join } = require('path')

exports.default = async function (context) {
  const { appOutDir, packager } = context
  const platform = packager.platform.name

  // Resolve the actual Resources directory
  let resourcesDir
  if (platform === 'mac') {
    // macOS: asar lives inside the .app bundle
    const appName = packager.appInfo.productName
    resourcesDir = join(appOutDir, `${appName}.app`, 'Contents', 'Resources')
  } else {
    // Windows / Linux: asar lives in resources/ alongside the executable
    resourcesDir = join(appOutDir, 'resources')
  }

  const asarPath = join(resourcesDir, 'app.asar')
  const tmpDir = join(appOutDir, 'asar-tmp')

  if (!existsSync(asarPath)) {
    console.log('[afterPack] No app.asar, skipping')
    return
  }

  // ── 1. Trim locales (keep en-US + zh-CN only) ──
  const localesDir = join(context.appOutDir, 'locales')
  if (existsSync(localesDir)) {
    const keep = new Set(['en-US.pak', 'zh-CN.pak'])
    const files = readdirSync(localesDir)
    let removed = 0
    for (const f of files) {
      if (!keep.has(f)) {
        unlinkSync(join(localesDir, f))
        removed++
      }
    }
    console.log(`[afterPack] Removed ${removed} unused locales`)
  }

  // ── 2. Strip models/src/server from asar ──
  try {
    console.log('[afterPack] Extracting app.asar...')
    execSync(`npx --yes asar extract "${asarPath}" "${tmpDir}"`, {
      stdio: 'pipe',
      timeout: 60000,
    })

    // Remove duplicated models (already in resources/models)
    execSync(`rm -rf "${join(tmpDir, 'models')}"`, { stdio: 'pipe' })
    // Remove source/config files not needed at runtime
    execSync(`rm -rf "${join(tmpDir, 'server')}"`, { stdio: 'pipe' })
    execSync(`rm -rf "${join(tmpDir, 'src')}"`, { stdio: 'pipe' })
    execSync(`rm -rf "${join(tmpDir, 'scripts')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, '.env.example')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, 'tsconfig.json')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, 'tsconfig.node.json')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, 'tsconfig.web.json')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, 'postcss.config.js')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, 'tailwind.config.ts')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, 'electron.vite.config.ts')}"`, { stdio: 'pipe' })
    execSync(`rm -f "${join(tmpDir, '.gitignore')}"`, { stdio: 'pipe' })

    console.log('[afterPack] Repacking app.asar...')
    execSync(`rm -f "${asarPath}"`, { stdio: 'pipe' })
    execSync(`npx --yes asar pack "${tmpDir}" "${asarPath}"`, {
      stdio: 'pipe',
      timeout: 120000,
    })

    console.log('[afterPack] asar optimized')
  } catch (e) {
    console.log('[afterPack] asar optimization skipped:', e.message?.slice(0, 100))
  } finally {
    // Cleanup
    execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' })
  }
}
