import { OcrResult } from '../types';
/**
 * Get image information (size and buffer).
 * Handles both file paths and Buffers.
 */
export declare function getImageInfo(input: string | Buffer): Promise<{
    fileSize: number;
    buffer: Buffer;
}>;
/**
 * Maps OCR.space API result structure to an array of OcrResult objects.
 * Assumes isOverlayRequired was set to true in the API call.
 */
export declare function mapOcrSpaceResultToOcrResultArray(ocrResult: any): OcrResult[];
/**
 * Handle various error types with appropriate messages.
 */
export declare function handleError(error: any): void;
/**
 * Simple delay utility
 */
export declare function delay(ms: number): Promise<void>;
