import { OCRConfig } from './smartOcrProcessor';
import { OcrResult } from '../types';
/**
 * Quick function for simple OCR processing.
 * Returns an array of OcrResult objects on success, throws error on failure.
 */
export declare function processImageForOCR(input: string | Buffer, apiKey: string, options?: Partial<OCRConfig>): Promise<OcrResult[]>;
/**
 * Batch OCR processing with smart tiling.
 * Returns an array of results, where each result includes filename and OcrResult[] or error.
 * Note: this is of low priority as it is not used in the project.
 */
export declare function batchOCRProcessing(inputDir: string, apiKey: string, outputDir?: string): Promise<{
    filename: string;
    result?: OcrResult[];
    error?: string;
}[]>;
