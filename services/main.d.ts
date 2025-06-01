/**
 * Processes a webtoon image through the pipeline to create an Anki package.
 * @param imageData The image data as a Buffer.
 * @param ocrApiKey The API key for the OCR service.
 * @param sourceLang The source language code for translation (e.g., 'ko').
 * @param targetLang The target language code for translation (e.g., 'en').
 * @returns A Promise that resolves with the Anki package data as an ArrayBuffer.
 * @throws Error if any step in the process fails.
 */
export declare function processWebtoonImage(imageData: Buffer, ocrApiKey: string, sourceLang?: string, // Default to Korean
targetLang?: string): Promise<ArrayBuffer>;
