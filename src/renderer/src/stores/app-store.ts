import { create } from 'zustand'
import type { PipelineStatus, TranscriptUpdate, LanguageCode, Direction } from '@shared/types'
import { LANGUAGE_INFO } from '../lib/constants'

interface TranscriptEntry {
  id: string
  original: string
  translated: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  timestamp: number
}

interface AppState {
  // Session state
  isSessionActive: boolean
  pipelineStatus: PipelineStatus
  direction: Direction
  languageA: LanguageCode
  languageB: LanguageCode

  // Transcripts
  transcripts: TranscriptEntry[]

  // Relay connection state
  connectionState: string
  connectionError: string | null

  // General error
  errorMessage: string | null

  // Settings visibility
  showSettings: boolean

  // Actions
  setSessionActive: (active: boolean) => void
  setPipelineStatus: (status: PipelineStatus) => void
  setDirection: (direction: Direction) => void
  setLanguages: (a: LanguageCode, b: LanguageCode) => void
  addTranscript: (entry: TranscriptEntry) => void
  updateLastTranscript: (translated: string) => void
  clearTranscripts: () => void
  setError: (message: string | null) => void
  setConnectionState: (state: string) => void
  setConnectionError: (error: string | null) => void
  setShowSettings: (show: boolean) => void
}

let transcriptIdCounter = 0

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isSessionActive: false,
  pipelineStatus: 'idle',
  direction: 'A->B',
  languageA: 'zh',
  languageB: 'en',
  transcripts: [],
  connectionState: 'idle',
  connectionError: null,
  errorMessage: null,
  showSettings: false,

  // Actions
  setSessionActive: (active) => set({ isSessionActive: active }),
  setPipelineStatus: (status) => set({ pipelineStatus: status }),
  setDirection: (direction) => set({ direction }),
  setLanguages: (a, b) => set({ languageA: a, languageB: b }),
  addTranscript: (entry) =>
    set((state) => ({
      transcripts: [...state.transcripts.slice(-50), entry] // Keep last 50
    })),
  updateLastTranscript: (translated) =>
    set((state) => {
      const transcripts = [...state.transcripts]
      if (transcripts.length > 0) {
        transcripts[transcripts.length - 1] = {
          ...transcripts[transcripts.length - 1],
          translated
        }
      }
      return { transcripts }
    }),
  clearTranscripts: () => set({ transcripts: [] }),
  setError: (message) => set({ errorMessage: message }),
  setConnectionState: (state) => set({ connectionState: state }),
  setConnectionError: (error) => set({ connectionError: error }),
  setShowSettings: (show) => set({ showSettings: show })
}))

// Helper to create a transcript entry
export function createTranscriptEntry(
  original: string,
  translated: string,
  source: LanguageCode,
  target: LanguageCode
): TranscriptEntry {
  return {
    id: `tr-${++transcriptIdCounter}`,
    original,
    translated,
    sourceLanguage: source,
    targetLanguage: target,
    timestamp: Date.now()
  }
}

// Helper to get display name for a language
export function getLanguageName(code: LanguageCode): string {
  return LANGUAGE_INFO[code]?.name ?? code
}

// Helper to get flag for a language
export function getLanguageFlag(code: LanguageCode): string {
  return LANGUAGE_INFO[code]?.flag ?? '🌐'
}
