/**
 * Defines the interface for translation engines.
 */
export interface ITranslationEngine {
  translateWord(word: string): Promise<string>;
  translateLine(line: string): Promise<string>;
}