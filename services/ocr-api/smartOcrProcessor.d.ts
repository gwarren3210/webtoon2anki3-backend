import { OcrResult } from '../types';
/**
 * Configuration for OCR and tiling behavior
 */
export interface OCRConfig {
    /** OCR Space API key */
    apiKey: string;
    /** File size threshold in bytes (default: 1MB) */
    fileSizeThreshold?: number;
    /** Overlap percentage for tiles (default: 0.10 = 10%) */
    overlapPercentage?: number;
    /** OCR language (default: 'eng') */
    language?: string;
    /** OCR engine (1 or 2, default: 2) */
    ocrEngine?: 1 | 2;
    /** Scale factor for large images (default: true) */
    scale?: boolean;
}
/**
 * Smart OCR processor that only tiles when necessary
 */
export declare class SmartOCRProcessor {
    private config;
    constructor(config: OCRConfig);
    /**
     * TODO: tiling is not implemented yet.
     * Process image with OCR, automatically tiling if file is too large.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    processImage(input: string | Buffer): Promise<OcrResult[]>;
    /**
     * Process image directly without tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private processDirectly;
    /**
     * TODO
     * Process image with adaptive tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private processWithTiling;
    /**
     * Create adaptive tiles based on file size and image dimensions.
     * Accepts either a file path or buffer as input.
     */
    private createAdaptiveTiles;
}
