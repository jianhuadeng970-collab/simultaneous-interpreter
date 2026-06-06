import { AppSettings } from '../../shared/types'

export const DEFAULT_SETTINGS: AppSettings = {
  setupComplete: false,
  uiLanguage: 'zh',
  languageA: 'zh',
  languageB: 'en',
  directionMode: 'manual',
  ttsVoices: {
    zh: 'VITS Speaker 0',
    en: 'Piper Lessac Medium'
  },
  sampleRate: 16000,
  vadThreshold: 0.5,
  playbackVolume: 0.8,
  bargeInEnabled: true,
  showTranscripts: true,
  relayServerUrl: 'https://dusty-turkey-78.jianhuadeng970-collab.deno.net'
}
