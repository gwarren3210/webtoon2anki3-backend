/**
 * Orchestrates image processing and vocabulary extraction.
 * Takes an image, performs OCR, groups text, and extracts vocabulary via AI.
 */

import { OcrResult, OcrLineResult } from './types';
import { processImageForOCR } from './ocr-api';
import {
  processAndGroupOcrResults,
  getDialogueFromGroupedText
} from './text-grouper';
import { createWordList } from '../gemini-api/create';
import type { Word, WordResponse } from './gemini-wrapper/geminiService';
import log from 'encore.dev/log';

export interface VocabularyExtractionResult {
  words: Word[];
  dialogueText: string;
  ocrResultCount: number;
  groupedLineCount: number;
}

/**
 * Processes an image through OCR and AI to extract vocabulary words.
 * @param tempImagePath Path to the temporary image file.
 * @returns Vocabulary extraction result with words and stats.
 */
export async function extractVocabularyFromImage(
  tempImagePath: string
): Promise<VocabularyExtractionResult> {
  log.info('Starting vocabulary extraction from image', { tempImagePath });

  // 1. OCR the image
  log.info('Performing OCR...');
  const ocrResults: OcrResult[] = await processImageForOCR(tempImagePath);
  log.info('OCR complete', { resultCount: ocrResults.length });

  // 2. Group text into meaningful chunks (speech bubbles)
  log.info('Grouping text...');
  const groupedTextData: OcrLineResult[] = processAndGroupOcrResults(
    ocrResults
  );
  log.info('Text grouping complete', { groupCount: groupedTextData.length });

  // 3. Extract dialogue lines
  const dialogueLines: string[] = getDialogueFromGroupedText(groupedTextData);
  const dialogueText = dialogueLines.join('');
  log.info('Dialogue extracted', {
    lineCount: dialogueLines.length,
    totalChars: dialogueText.length
  });

  // 4. Extract vocabulary using Gemini AI
  log.info('Extracting vocabulary via Gemini AI...');
  const wordResponse: WordResponse = await createWordList(dialogueText);
  log.info('Vocabulary extraction complete', {
    wordCount: wordResponse.words.length
  });

  return {
    words: wordResponse.words,
    dialogueText,
    ocrResultCount: ocrResults.length,
    groupedLineCount: groupedTextData.length
  };
}

