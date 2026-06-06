import { LanguageCode } from '../../../shared/types'
import { TranslationService } from './translation-interface'

/**
 * NLLB-200 language codes for Transformers.js.
 * NLLB (No Language Left Behind) by Meta supports 200 languages.
 */
const NLLB_CODES: Record<LanguageCode, string> = {
  zh: 'zho_Hans',
  en: 'eng_Latn'
}

/**
 * Local translation service using NLLB-200 via Transformers.js.
 *
 * NLLB-200 distilled-600M model (~350MB) supports all 200 languages
 * including Chinese (zho_Hans), Thai (tha_Thai), and Khmer (khm_Khmer).
 *
 * Model will be auto-downloaded on first use from HuggingFace.
 * Inference runs entirely on CPU — no GPU required.
 */
export class LocalTranslationService implements TranslationService {
  private pipeline: unknown = null
  private currentSource: LanguageCode = 'zh'
  private currentTarget: LanguageCode = 'en'

  /** Transformers.js module */
  private transformers: {
    pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>
    env: { localModelPath?: string; allowRemoteModels: boolean }
  } | null = null

  setPair(source: LanguageCode, target: LanguageCode): void {
    this.currentSource = source
    this.currentTarget = target
  }

  async translate(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode
  ): Promise<string> {
    if (!text || !text.trim()) return ''

    // Lazy-load Transformers.js
    if (!this.transformers) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        this.transformers = require('@xenova/transformers') as typeof this.transformers
      } catch {
        throw new Error(
          'Transformers.js 未安装。请运行:\n' +
          'npm install @xenova/transformers'
        )
      }
    }

    try {
      // Create translation pipeline (cached after first call)
      if (!this.pipeline) {
        this.pipeline = await this.transformers!.pipeline(
          'translation',
          'Xenova/nllb-200-distilled-600M',
          {
            // Limit output length to avoid very long translations
            max_new_tokens: 256
          }
        )
      }

      // Build NLLB input with language tokens
      const srcCode = NLLB_CODES[sourceLanguage]
      const tgtCode = NLLB_CODES[targetLanguage]

      // Run translation
      const pipelineAny = this.pipeline as (
        text: string,
        options: Record<string, unknown>
      ) => Promise<Array<{ translation_text: string }>>

      const result = await pipelineAny(text, {
        src_lang: srcCode,
        tgt_lang: tgtCode,
        max_new_tokens: 256
      })

      if (result && result.length > 0 && result[0].translation_text) {
        return result[0].translation_text.trim()
      }

      throw new Error('No translation result')
    } catch (error) {
      console.error('[LocalTranslation] Error:', error)
      throw new Error(`本地翻译失败: ${error}`)
    }
  }
}
