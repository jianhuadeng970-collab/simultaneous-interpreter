import type { ElectronAPI } from '@preload/types'

/**
 * Typed accessor for the preload-exposed electronAPI.
 * This ensures type safety when calling main process functions from the renderer.
 */
export function getElectronAPI(): ElectronAPI {
  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
  if (!api) {
    throw new Error(
      'electronAPI is not available. Ensure the preload script is loaded correctly.'
    )
  }
  return api
}
