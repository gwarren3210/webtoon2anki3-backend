import { ITranslationEngine } from "./translationEngine";
import { OcrLineResult, TranslatedWordInfo } from "../types";
/**
 * Implementation of ITranslationEngine using the papago-translate NPM package.
 */
export declare class PapagoTranslateEngine implements ITranslationEngine {
    private papagoInstance;
    private sourceLang;
    private targetLang;
    /**
     * @param sourceLang - The source language code (e.g., 'ko').
     * @param targetLang - The target language code (e.g., 'en').
     * @param papagoOptions - Optional configuration for the Papago instance.
     */
    constructor(sourceLang: string, targetLang: string, papagoOptions?: {
        save_device_id?: boolean;
        user_agent?: string;
    });
    translateDeck(deck: OcrLineResult[]): Promise<TranslatedWordInfo[]>;
    /**
     * Translates a single word using the Papago API.
     * @param word - The word to translate.
     * @returns A promise that resolves with the translated word.
     */
    private translationCache;
    /**
     * Translates a single word using the Papago API with caching.
     * @param word - The word to translate.
     * @returns A promise that resolves with the translated word.
     */
    translateWord(word: string): Promise<string>;
    /**
     * Translates a full line using the Papago API with caching.
     * @param line - The line to translate.
     * @returns A promise that resolves with the translated line.
     */
    translateLine(line: string): Promise<string>;
}
