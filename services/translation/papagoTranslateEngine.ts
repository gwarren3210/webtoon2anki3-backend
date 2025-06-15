import { ITranslationEngine } from "./translationEngine";
import PapagoTranslate from "papago-translate";
import { OcrLineResult, TranslatedWordInfo } from "../types";
import log from 'encore.dev/log';

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
    this.papagoInstance = new PapagoTranslate.Papago(papagoOptions);
    this.translationCache = new Map();
    log.info('Initialized Papago translation engine', {
      sourceLang,
      targetLang,
      hasOptions: !!papagoOptions
    });
  }

  async translateDeck(deck: OcrLineResult[]): Promise<TranslatedWordInfo[]> {
    log.info('Starting deck translation', {
      lineCount: deck.length
    });

    const result: TranslatedWordInfo[] = [];
    for (const ocrLineResult of deck) {
      // Skip empty lines
      if (!ocrLineResult.line.trim()) {
        log.debug('Skipping empty line', {
          bbox: ocrLineResult.bbox
        });
        continue;
      }

      log.info('Translating line', {
        line: ocrLineResult.line,
        wordCount: ocrLineResult.line.split(" ").length
      });

      const translatedLine = await this.translateLine(ocrLineResult.line);
      const words = ocrLineResult.line.split(" ").filter(word => word.trim()); // Filter out empty words
      
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

    log.info('Completed deck translation', {
      totalWords: result.length
    });

    return result;
  }

  /**
   * Translates a single word using the Papago API with caching.
   * @param word - The word to translate.
   * @returns A promise that resolves with the translated word.
   */
  async translateWord(word: string): Promise<string> {
    // Skip empty words
    if (!word.trim()) {
      log.debug('Skipping empty word');
      return '';
    }

    const cachedTranslation = this.translationCache.get(word);
    if (cachedTranslation) {
      log.debug('Using cached translation for word', {
        word,
        translation: cachedTranslation
      });
      return cachedTranslation;
    }

    log.info('Translating word', {
      word,
      sourceLang: this.sourceLang,
      targetLang: this.targetLang
    });

    try {
      const result = await this.papagoInstance.translate({
        text: word,
        from: this.sourceLang,
        to: this.targetLang,
      });
      
      if (result.error) {
        log.error('Papago translation error for word', {
          word,
          error: result.error
        });
        throw new Error("Papago translation error: " + JSON.stringify(result));
      }
      
      const translation = result.translatedText || result.result?.translation;
      if (!translation) {
        log.error('Invalid translation result format for word', {
          word,
          result
        });
        throw new Error("Invalid translation result format");
      }
      
      this.translationCache.set(word, translation);
      log.info('Successfully translated word', {
        word,
        translation
      });
      return translation;
    } catch (error) {
      log.error('Error translating word with Papago', {
        word,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Translates a full line using the Papago API with caching.
   * @param line - The line to translate.
   * @returns A promise that resolves with the translated line.
   */
  async translateLine(line: string): Promise<string> {
    // Skip empty lines
    if (!line.trim()) {
      log.debug('Skipping empty line');
      return '';
    }

    const cachedTranslation = this.translationCache.get(line);
    if (cachedTranslation) {
      log.debug('Using cached translation for line', {
        line,
        translation: cachedTranslation
      });
      return cachedTranslation;
    }

    log.info('Translating line', {
      line,
      sourceLang: this.sourceLang,
      targetLang: this.targetLang
    });

    try {
      const result = await this.papagoInstance.translate({
        text: line,
        from: this.sourceLang,
        to: this.targetLang,
      });
      
      if (result.error) {
        log.error('Papago translation error for line', {
          line,
          error: result.error
        });
        throw new Error("Papago translation error: " + JSON.stringify(result));
      }
      
      const translation = result.translatedText || result.result?.translation;
      if (!translation) {
        log.error('Invalid translation result format for line', {
          line,
          result
        });
        throw new Error("Invalid translation result format");
      }
      
      this.translationCache.set(line, translation);
      log.info('Successfully translated line', {
        line,
        translation
      });
      return translation;
    } catch (error) {
      log.error('Error translating line with Papago', {
        line,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}