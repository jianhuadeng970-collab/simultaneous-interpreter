import { LanguageCode } from '../../../shared/types'
import { AsrResult } from '../../pipeline/types'

/**
 * Abstract interface for Speech-to-Text (ASR) services.
 * All implementations must support Chinese (zh), Thai (th), and Khmer (km).
 */
export interface AsrService {
  /**
   * Initialize the ASR service with credentials and target language.
   */
  initialize(language: LanguageCode): Promise<void>

  /**
   * Recognize speech from PCM audio data (Int16, 16kHz, mono).
   * Returns streaming results — call onResult callback for each interim/final result.
   */
  recognizeStream(
    pcmChunk: Buffer,
    onResult: (result: AsrResult) => void,
    onError: (error: Error) => void
  ): void

  /**
   * Signal end of audio stream — flush any remaining buffered audio.
   */
  endStream(): Promise<AsrResult | null>

  /**
   * Switch recognition language mid-session.
   */
  setLanguage(language: LanguageCode): void

  /**
   * Close the recognition session and release resources.
   */
  close(): Promise<void>
}
