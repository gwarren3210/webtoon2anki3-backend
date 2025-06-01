// import sharp from 'sharp';
import { promises as fs } from 'fs';
// import path from 'path';
import { OcrResult, BoundingBox } from '../types'; // Import original types

/**
 * Get image information (size and buffer).
 * Handles both file paths and Buffers.
 */
export async function getImageInfo(input: string | Buffer): Promise<{ fileSize: number; buffer: Buffer }> {
    if (typeof input === 'string') {
        // Check if file exists
        try {
            await fs.access(input);
        } catch (error) {
            throw new Error(`File not found: ${input}`);
        }
        const stats = await fs.stat(input);
        const buffer = await fs.readFile(input);
        return { fileSize: stats.size, buffer };
    } else if (Buffer.isBuffer(input)) {
         return { fileSize: input.length, buffer: input };
    } else {
        throw new Error('Invalid input type. Must be string (file path) or Buffer.');
    }
}

 /**
  * Maps OCR.space API result structure to an array of OcrResult objects.
  * Assumes isOverlayRequired was set to true in the API call.
  */
 export function mapOcrSpaceResultToOcrResultArray(ocrResult: any): OcrResult[] {
     const results: OcrResult[] = [];

     if (ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0) {
         for (const parsedResult of ocrResult.ParsedResults) {
             if (parsedResult.TextOverlay && parsedResult.TextOverlay.Lines) {
                 for (const line of parsedResult.TextOverlay.Lines) {
                     for (const word of line.Words) {
                         const bbox: BoundingBox = {
                             x: word.Left,
                             y: word.Top,
                             width: word.Width,
                             height: word.Height,
                         };
                         results.push({
                             text: word.WordText,
                             bbox,
                         });
                     }
                 }
             }
         }
     }

     return results;
 }

/**
 * Handle various error types with appropriate messages.
 */
export function handleError(error: any): void {
    console.error('OCR Processing error:', error);

    let errorMessage = 'Unknown error occurred';

    if (error?.message?.includes('File size too large') ||
        error?.message?.includes('413') ||
        error?.message?.includes('Request Entity Too Large')) {
        errorMessage = 'File too large for OCR processing. Try reducing image size or resolution.';
    } else if (error?.message?.includes('Invalid API key')) {
        errorMessage = 'Invalid OCR Space API key provided';
    } else if (error?.message?.includes('Rate limit')) {
        errorMessage = 'OCR API rate limit exceeded. Please try again later.';
    } else if (error?.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error?.message) {
        errorMessage = error.message;
    }

    // Log the specific error message
    console.error(`Specific Error: ${errorMessage}`);

    // Note: We are not returning an OCRResult with error here, but re-throwing
    // The caller of processImage should catch and handle the thrown error.
}

/**
 * Simple delay utility
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
} 