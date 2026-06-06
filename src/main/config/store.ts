import Store from 'electron-store'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, renameSync, copyFileSync } from 'fs'
import { AppSettings } from '../../shared/types'
import { DEFAULT_SETTINGS } from './defaults'

/**
 * Safely create the electron-store instance.
 *
 * On Windows especially, a corrupted config JSON file (e.g. from an unclean
 * shutdown, disk error, or encoding issue) causes Conf._deserialize to throw
 * an unhandled SyntaxError during JSON.parse — which crashes the entire app
 * before any window appears.
 *
 * Here we catch that error, back up the broken file, and restart with defaults.
 */
function createStore(): Store<AppSettings> {
  try {
    return new Store<AppSettings>({ defaults: DEFAULT_SETTINGS })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Only recover from JSON parse errors — re-throw everything else
    if (
      message.includes('JSON') ||
      message.includes('Unexpected token') ||
      message.includes('not valid JSON')
    ) {
      const configPath = join(app.getPath('userData'), 'config.json')
      console.warn(
        `[ConfigStore] Corrupted config detected at ${configPath}: ${message}`
      )

      if (existsSync(configPath)) {
        try {
          // Back up the broken file so the user / developer can inspect it
          const backupPath = configPath + `.corrupted-${Date.now()}`
          renameSync(configPath, backupPath)
          console.warn(`[ConfigStore] Corrupted config moved to ${backupPath}`)
        } catch (moveErr) {
          console.error(`[ConfigStore] Failed to move corrupted config: ${moveErr}`)
          // If we can't rename, try to delete it directly
          try {
            const { unlinkSync } = require('fs')
            unlinkSync(configPath)
          } catch (_) {
            /* last resort — the constructor will still fail below */
          }
        }
      }

      // Retry with a clean slate
      try {
        return new Store<AppSettings>({ defaults: DEFAULT_SETTINGS })
      } catch (retryErr) {
        console.error(
          `[ConfigStore] Still cannot create store after recovery: ${retryErr}`
        )
        throw retryErr
      }
    }

    // Unknown error — re-throw so it surfaces visibly
    throw err
  }
}

const store = createStore()

export function getSettings(): AppSettings {
  return store.store
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return store.get(key)
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key as keyof AppSettings, value as never)
  }
  return store.store
}

export default store
