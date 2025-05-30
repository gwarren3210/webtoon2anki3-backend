import sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ocrSpace } from 'ocr-space-api-wrapper';
import { OcrResult, BoundingBox } from './types'; // Import original types
import * as os from 'os';
import { randomUUID } from 'crypto';
import { getImageInfo, mapOcrSpaceResultToOcrResultArray, handleError, delay } from './ocrApiUtils'; // Import utilities

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
export class SmartOCRProcessor {
    private config: Required<OCRConfig>;

    constructor(config: OCRConfig) {
        this.config = {
            fileSizeThreshold: 1 * 1024 * 1024, // 1MB default
            overlapPercentage: 0.10, // 10% default
            language: 'kor',
            ocrEngine: 2,
            scale: true,
            ...config
        };
    }

    /**
     * Process image with OCR, automatically tiling if file is too large.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    async processImage(input: string | Buffer): Promise<OcrResult[]> {
        const tempDir = os.tmpdir();
        const uniqueId = randomUUID();
        const tempImagePath = path.join(tempDir, `upload_${uniqueId}.jpg`);

        try {
            console.log('Starting smart OCR processing...');

            // Get file size and basic info
            const { fileSize } = await getImageInfo(input); // Use imported utility
            console.log(`Image size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

            // Save buffer to a temporary file
            //TODO: figure out error below
            //await fs.writeFile(tempImagePath, buffer);
             console.log(`Saved temporary image to ${tempImagePath}`);

            // Check if we need to tile based on file size
            const needsTiling = fileSize > this.config.fileSizeThreshold;
            console.log(`Tiling ${needsTiling ? 'required' : 'not required'} (threshold: ${(this.config.fileSizeThreshold / 1024 / 1024).toFixed(2)}MB)`);

            if (!needsTiling) {
                // Process directly without tiling using the temporary file path
                return await this.processDirectly(input);
            } else {
                // Process with adaptive tiling using the temporary file path
                // Note: Tiling logic will need to work with the file path or re-read sections as buffers
                 // For now, simplifying by passing the whole file path to the tiling process,
                 // which will need further refinement to handle tiling based on the file.
                return await this.processWithTiling(tempImagePath);
            }

        } catch (error) {
            handleError(error); // Use imported utility
            throw error; // Re-throw after handling
        } finally {
             // Clean up temporary file
             // TODO: boolean doesnt solve the issue
             if (path.resolve(tempImagePath)) {
                 try {
                     await fs.unlink(tempImagePath);
                     console.log(`Cleaned up temporary image file ${tempImagePath}`);
                 } catch (cleanupError) {
                     console.error(`Failed to clean up temporary image file ${tempImagePath}:`, cleanupError);
                 }
             }
        }
    }

    /**
     * Process image directly without tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private async processDirectly(input: string | Buffer): Promise<OcrResult[]> {
        console.log('Processing image directly (no tiling required)');

        try {
            const ocrResult = await ocrSpace(input, {
                apiKey: this.config.apiKey,
                language: this.config.language as any, // Cast to any to resolve linter error - TODO: use OcrSpaceLanguages type if accessible
                OCREngine: this.config.ocrEngine === 1 ? "1" : "2",
                scale: this.config.scale,
                isTable: false,
                isOverlayRequired: true, // Request overlay to get bounding boxes
            });

            if (ocrResult.OCRExitCode === 1) {
               console.log('OCR result:', ocrResult);
                return mapOcrSpaceResultToOcrResultArray(ocrResult); // Use imported utility
            } else {
                throw new Error(`OCR failed: ${ocrResult.ErrorMessage || 'Unknown error'}`);
            }

        } catch (error) {
            throw error; // Let the calling function handle/re-throw
        }
    }

    /**
     * Process image with adaptive tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private async processWithTiling(filePath: string): Promise<OcrResult[]> {
        console.log('Processing image with adaptive tiling');

        try {
            // TODO: Modify createAdaptiveTiles to work with a file path or stream

            // Create tiles with adaptive height
            const tiles = await this.createAdaptiveTiles(filePath);

            const allOcrResults: OcrResult[] = [];
            let processedTiles = 0;

            // Process each tile
            for (let i = 0; i < tiles.length; i++) {
                console.log(`Processing tile ${i + 1}/${tiles.length}...`);

                try {
                    const tileBuffer = await tiles[i].jpeg({ quality: 85 }).toBuffer();

                    // TODO: Process individual tiles. ocrSpace needs a file path or base64.
                    // Saving each tile to a temp file or converting to base64 would work, but adds overhead.
                    // The ideal tiling solution should yield file paths or base64 directly.

                     const ocrResult = await ocrSpace(tileBuffer.toString('base64'), {
                           apiKey: this.config.apiKey,
                           language: this.config.language as any, // Cast to any to resolve linter error - TODO: use OcrSpaceLanguages type if accessible
                           OCREngine: this.config.ocrEngine === 1 ? "1" : "2",
                           scale: this.config.scale,
                           isTable: false,
                           isOverlayRequired: true,
                       });

                    if (ocrResult.OCRExitCode === 1) {
                         // Map tile-relative bboxes to image coordinates
                        const tileResults = mapOcrSpaceResultToOcrResultArray(ocrResult); // Use imported utility

                        // Need original tile position to map coordinates
                        // This requires storing tile position when creating tiles.
                        // For now, this is a simplified mapping.
                         allOcrResults.push(...tileResults); // Basic concatenation
                         processedTiles++;

                    } else {
                        console.warn(`Tile ${i + 1} OCR failed: ${ocrResult.ErrorMessage}`);
                    }

                    // Add small delay to avoid rate limiting
                    await delay(500); // Use imported utility

                } catch (tileError) {
                    console.warn(`Error processing tile ${i + 1}:`, tileError);
                }
            }

            if (processedTiles === 0) {
                throw new Error('No tiles could be processed successfully');
            }

            // TODO: Implement smart text merging and coordinate adjustment for overlapping tiles
            // The current simple concatenation and lack of original tile position means overlapping results are duplicated
            // and coordinates are tile-relative, not image-relative.

            return allOcrResults; // Returning concatenated tile results for now

        } catch (error) {
            throw error; // Let the calling function handle/re-throw
        }
    }

    /**
     * Create adaptive tiles based on file size and image dimensions.
     * Accepts either a file path or buffer as input.
     */
    private async createAdaptiveTiles(input: Buffer | string): Promise<sharp.Sharp[]> {
      
        const image = sharp(input);
        const metadata = await image.metadata();

        const imgWidth = metadata.width!;
        const imgHeight = metadata.height!;
        const fileSize = input instanceof Buffer ? input.length : (await fs.stat(input)).size;

        console.log(`Image dimensions: ${imgWidth}x${imgHeight}`);

        // Calculate adaptive tile height based on excess file size
        const excessRatio = fileSize / (1024 * 1024); // How many times over 1MB
        const baseDivisions = Math.ceil(excessRatio);
        const overlapFactor = 1 - this.config.overlapPercentage; // 0.90 for 10% overlap
        const adjustedDivisions = baseDivisions / overlapFactor;
        const tileHeight = Math.floor(imgHeight / adjustedDivisions);

        console.log(`Using adaptive tiling: base divisions=${baseDivisions}, adjusted divisions=${adjustedDivisions}, tile height=${tileHeight}`);

        const tiles: sharp.Sharp[] = [];
        let startY = 0;

        while (startY < imgHeight) {
            const endY = Math.min(startY + tileHeight, imgHeight);
            const actualTileHeight = endY - startY;

            const tile = image.clone().extract({
                left: 0,
                top: startY,
                width: imgWidth,
                height: actualTileHeight
            });

            tiles.push(tile); // Store sharp instance for later processing

            // Move startY for the next tile, accounting for overlap
            const overlapHeight = Math.floor(this.config.overlapPercentage * tileHeight);
            startY += tileHeight - overlapHeight;

            // If the next startY is very close to the bottom, ensure the last tile covers the rest
             if (startY >= imgHeight - overlapHeight && endY < imgHeight) {
                 startY = imgHeight - actualTileHeight + overlapHeight; // Go back one tile height minus overlap from the bottom
             } else if (startY >= imgHeight) {
                 break; // Stop if we are past the image height
             }
        }

        return tiles;
    }
} 