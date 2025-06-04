import { ITranslationEngine } from "./translationEngine";
import PapagoTranslate from "papago-translate";
import { OcrLineResult, TranslatedWordInfo } from "../types";

/**
 * Implementation of ITranslationEngine using the papago-translate NPM package.
 */
export class PapagoTranslateEngine implements ITranslationEngine {
  private papagoInstance: any;
  private sourceLang: string;
  private targetLang: string;
  private translationCache: Map<string, string>;

  /**
   * @param sourceLang - The source language code (e.g., 'ko').
   * @param targetLang - The target language code (e.g., 'en').
   * @param papagoOptions - Optional configuration for the Papago instance.
   */
  constructor(
    sourceLang: string,
    targetLang: string,
    papagoOptions?: { save_device_id?: boolean; user_agent?: string }
  ) {
    this.sourceLang = sourceLang;
    this.targetLang = targetLang;
    this.papagoInstance = new PapagoTranslate(papagoOptions);
    this.translationCache = new Map();
  }

  async translateDeck(deck: OcrLineResult[]): Promise<TranslatedWordInfo[]> {
    const result: TranslatedWordInfo[] = [];
    for (const ocrLineResult of deck) {
      const translatedLine = await this.translateLine(ocrLineResult.line);
      const words = ocrLineResult.line.split(" ");
      for (const word of words) {
        const translatedWord = await this.translateWord(word);
        result.push({
          originalWord: word,
          translatedWord,
          originalLine: ocrLineResult.line,
          originalLineBbox: ocrLineResult.bbox,
          translatedLine,
        });
      }
    }
    return result;
  }

  /**
   * Translates a single word using the Papago API with caching.
   * @param word - The word to translate.
   * @returns A promise that resolves with the translated word.
   */
  async translateWord(word: string): Promise<string> {
    const cachedTranslation = this.translationCache.get(word);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    try {
      const result = await this.papagoInstance.translate({
        text: word,
        from: this.sourceLang,
        to: this.targetLang,
      });
      
      if (result.error) {
        throw new Error("Papago translation error: " + JSON.stringify(result));
      }
      
      const translation = result.translatedText || result.result?.translation;
      if (!translation) {
        throw new Error("Invalid translation result format");
      }
      
      this.translationCache.set(word, translation);
      return translation;
    } catch (error) {
      console.error("Error translating word with Papago:", error);
      throw error;
    }
  }

  /**
   * Translates a full line using the Papago API with caching.
   * @param line - The line to translate.
   * @returns A promise that resolves with the translated line.
   */
  async translateLine(line: string): Promise<string> {
    const cachedTranslation = this.translationCache.get(line);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    try {
      const result = await this.papagoInstance.translate({
        text: line,
        from: this.sourceLang,
        to: this.targetLang,
      });
      
      if (result.error) {
        throw new Error("Papago translation error: " + JSON.stringify(result));
      }
      
      const translation = result.translatedText || result.result?.translation;
      if (!translation) {
        throw new Error("Invalid translation result format");
      }
      
      this.translationCache.set(line, translation);
      return translation;
    } catch (error) {
      console.error("Error translating line with Papago:", error);
      throw error;
    }
  }
}