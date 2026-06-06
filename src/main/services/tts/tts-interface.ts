import { LanguageCode } from '../../../shared/types'
import { TtsResult } from '../../pipeline/types'

/**
 * Abstract interface for Text-to-Speech (TTS) services.
 */
export interface TtsService {
  /**
   * Synthesize speech from text.
   * Returns audio data (WAV buffer).
   */
  synthesize(text: string, language: LanguageCode, speakerId?: number): Promise<TtsResult>

  /**
   * Synthesize speech in streaming mode.
   * Calls onAudioChunk for each chunk of audio data.
   */
  synthesizeStream(
    text: string,
    language: LanguageCode,
    onAudioChunk: (chunk: Buffer) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): void

  /**
   * Set the voice for a specific language.
   */
  setVoice(language: LanguageCode, voiceName: string): void

  /**
   * Stop any ongoing synthesis.
   */
  stop(): void
}
