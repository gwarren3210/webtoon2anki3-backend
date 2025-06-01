/* 
 * This file is the main backend service.
 * It takes in the image and returns the .apkg file.
 * It does this by calling each service in the order of the steps.
 * 
 * The steps are:
 * 1. OCR the image to get the text.
 *    translate the text to english
 * 2. Convert the text to flashcards.
 * 3. Convert the flashcards to an .apkg file.
 * 4. Return the .apkg file.
*/

import { OcrResult, TranslatedWordInfo, OcrLineResult } from './types';
import { processImageForOCR } from './ocr-api';
import { processAndGroupOcrResults } from './text-grouper'; // Assuming this is the correct function
import { PapagoTranslateEngine } from './translation/papagoTranslateEngine';
import { handleAnkiPackageCreation } from './anki/ankiPackageHandler';
// import * as storage from './storage';
// Consider importing validation logic if available
// import { validateImageData } from './validation';

/**
 * Processes a webtoon image through the pipeline to create an Anki package.
 * @param tempImagePath The image data as a path to the file.
 * @param ocrApiKey The API key for the OCR service.
 * @param sourceLang The source language code for translation (e.g., 'ko').
 * @param targetLang The target language code for translation (e.g., 'en').
 * @returns A Promise that resolves with the Anki package data as an ArrayBuffer.
 * @throws Error if any step in the process fails.
 */
export async function processWebtoonImage(
  tempImagePath: string,
  ocrApiKey: string,
  sourceLang: string = 'ko', // Default to Korean
  targetLang: string = 'en' // Default to English
): Promise<ArrayBuffer> {
  try {
    // 1. Validate Input
    // await validateImageData(imageData);
    console.log('Starting image processing.');

    // 2. OCR the image
    console.log('Performing OCR...');
    const ocrResults: OcrResult[] = await processImageForOCR(tempImagePath, ocrApiKey);
    console.log(`OCR complete. Found ${ocrResults.length} text results.`);

    // 3. Group text into meaningful chunks
    console.log('Grouping text...');
    // The output type of processAndGroupOcrResults needs to be suitable for translation
    // Let's assume it returns an array of strings or objects containing text
    const groupedTextData: OcrLineResult[] = processAndGroupOcrResults(ocrResults);
    console.log('Text grouping complete.');

    // 4. Translate text
    console.log('Translating text...');
    const translationEngine = new PapagoTranslateEngine(sourceLang, targetLang);
    const translatedWordInfos: TranslatedWordInfo[] = await translationEngine.translateDeck(groupedTextData);
    console.log('Translation complete.');

    // 5. Create Anki cards and generate .apkg file
    console.log('Creating Anki package...');
    const ankiPackageBuffer: ArrayBuffer = await handleAnkiPackageCreation(translatedWordInfos);
    console.log('Anki package creation complete.');

    // 6. Return the .apkg file data
    console.log('Image processing finished successfully.');
    return ankiPackageBuffer;

  } catch (error: any) {
    console.error('Error during webtoon image processing:', error);
    // Re-throw the error after logging
    throw new Error(`Webtoon image processing failed: ${error.message}`);
  }
}

// You might want to add an example usage function here if needed,
// but the primary export is processWebtoonImage.

// TODO implement buffer handling
export async function handleProcessWebtoonImage(
  imageBuffer: Buffer,
  ocrApiKey: string,
  sourceLang: string = 'ko', // Default to Korean
  targetLang: string = 'en' // Default to English
)  {
}