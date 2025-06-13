import log from 'encore.dev/log';

/**
 * Defines the interface for translation engines.
 */
export interface ITranslationEngine {
  /**
   * Translates a single word from source language to target language.
   * @param word - The word to translate
   * @returns Promise resolving to the translated word
   */
  translateWord(word: string): Promise<string>;

  /**
   * Translates a full line of text from source language to target language.
   * @param line - The line to translate
   * @returns Promise resolving to the translated line
   */
  translateLine(line: string): Promise<string>;
}