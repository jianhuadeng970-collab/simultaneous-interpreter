import { LanguageCode } from '../../../shared/types'

/**
 * Abstract interface for Translation services.
 */
export interface TranslationService {
  /**
   * Translate text from source language to target language.
   */
  translate(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode
  ): Promise<string>

  /**
   * Set the language pair for subsequent translations.
   */
  setPair(source: LanguageCode, target: LanguageCode): void
}
