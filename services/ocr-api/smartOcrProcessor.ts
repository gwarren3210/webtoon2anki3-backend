import sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ocrSpace } from 'ocr-space-api-wrapper';
import { OcrResult, BoundingBox } from '../types'; // Import original types
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
 * Represents the absolute bounding box of the tile from which an OCR result originated.
 */
export interface TileContext extends BoundingBox {}

/**
 * Extends OcrResult to include the context of the tile it came from.
 */
export interface OcrResultWithContext extends OcrResult {
    tileContext: TileContext;
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
     * TODO: tiling is not implemented yet.
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
            const { fileSize, buffer } = await getImageInfo(input); // Use imported utility
            console.log(`Image size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

            // Save buffer to a temporary file
            await fs.writeFile(tempImagePath, new Uint8Array(buffer));
            console.log(`Saved temporary image to ${tempImagePath}`);

            // Check if we need to tile based on file size
            const needsTiling = fileSize > this.config.fileSizeThreshold;
            console.log(`Tiling ${needsTiling ? 'required' : 'not required'} (threshold: ${(this.config.fileSizeThreshold / 1024 / 1024).toFixed(2)}MB)`);

            if (!needsTiling) {
                // Process directly without tiling using the temporary file path
                return await this.processDirectly(tempImagePath);
            } else {
                // Process with adaptive tiling using the temporary file path
                // Note: Tiling logic will need to work with the file path or re-read sections as buffers
                 // For now, simplifying by passing the whole file path to the tiling process,
                 // which will need further refinement to handle tiling based on the file.
                return await this.processWithTiling(tempImagePath);
            }
        } catch (error: any) {
            // Check if the error is a timeout error and switch engines
            /* if (error.message && error.message.includes('E101: Timed out waiting for results') && this.config.ocrEngine === 2) {
                console.warn('OCR timed out with engine 2, retrying with engine 1...');
                // Temporarily switch to engine 1
                const originalEngine = this.config.ocrEngine;
                this.config.ocrEngine = 1;
                try {
                    // Retry with engine 1
                    return await this.processDirectly(input);
                } finally {
                    // Restore original engine setting
                    this.config.ocrEngine = originalEngine;
                }
            } */
            handleError(error); // Use imported utility
            throw error; // Re-throw after handling
        } finally {
             // Clean up temporary file
             try {
                await fs.unlink(tempImagePath);
                console.log(`Cleaned up temporary image file ${tempImagePath}`);
            } catch (cleanupError) {
                console.warn(`Failed to clean up temporary image file ${tempImagePath}:`, cleanupError);
            }
        }
    }

    /**
     * Process image directly without tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private async processDirectly(input: string): Promise<OcrResult[]> {
        console.log('Processing image directly (no tiling required)');

        try {
            console.log("Sending OCR request...")
            const ocrResult = await ocrSpace(input, {
                apiKey: /* this.config.apiKey || */ 'helloworld', // default api key limit 10 reqs check official site
                language: this.config.language as any, // Cast to any to resolve linter error - TODO: use OcrSpaceLanguages type if accessible
                OCREngine: this.config.ocrEngine === 1 ? "1" : "2",
                scale: this.config.scale,
                isTable: false,
                isOverlayRequired: true, // Request overlay to get bounding boxes
            });
            console.log("received OCR result")
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
     * TODO
     * Process image with adaptive tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private async processWithTiling(filePath: string): Promise<OcrResult[]> {
        console.log('Processing image with adaptive tiling');

        const tempDir = os.tmpdir();
        const uniqueId = randomUUID();
        const allOcrResults: OcrResultWithContext[] = []; // Changed type here
        let processedTiles = 0;

        try {
            const image = sharp(filePath);
            const metadata = await image.metadata();
            const imgWidth = metadata.width!;
            const imgHeight = metadata.height!;

            // Create tiles with adaptive height
            const tiles = await this.createAdaptiveTiles(filePath);

            // Process each tile
            for (const { tile, startY } of tiles) { // Destructure to get tile and startY
                console.log(`Processing tile starting at y=${startY}...`);

                const tileTempImagePath = path.join(tempDir, `tile_${uniqueId}_${startY}.jpg`);
                try {
                    await tile.jpeg({ quality: 85 }).toFile(tileTempImagePath);

                    const ocrResult = await ocrSpace(tileTempImagePath, {
                        apiKey: this.config.apiKey,
                        language: this.config.language as any,
                        OCREngine: this.config.ocrEngine === 1 ? "1" : "2",
                        scale: this.config.scale,
                        isTable: false,
                        isOverlayRequired: true,
                    });

                    if (ocrResult.OCRExitCode === 1) {
                        // Define the absolute bounding box of the current tile
                        const tileContext: TileContext = {
                            x: 0, // Tiles are full width for now
                            y: startY,
                            width: imgWidth,
                            height: (await tile.metadata()).height! // Actual height of the extracted tile
                        };

                        let tileResults = mapOcrSpaceResultToOcrResultArray(ocrResult); // Use imported utility

                        // Map tile-relative bboxes to image coordinates and add tile context
                        const resultsWithContext: OcrResultWithContext[] = tileResults.map(res => ({
                            ...res,
                            bbox: {
                                x: res.bbox.x,
                                y: res.bbox.y + startY, // Adjust y-coordinate by tile's startY
                                width: res.bbox.width,
                                height: res.bbox.height,
                            },
                            tileContext: tileContext // Add the tile context
                        }));

                        allOcrResults.push(...resultsWithContext);
                        processedTiles++;

                    } else {
                        console.warn(`Tile starting at y=${startY} OCR failed: ${ocrResult.ErrorMessage}`);
                    }

                    // Add small delay to avoid rate limiting
                    await delay(500);

                } catch (tileError) {
                    console.warn(`Error processing tile starting at y=${startY}:`, tileError);
                } finally {
                    try {
                        await fs.unlink(tileTempImagePath);
                        // console.log(`Cleaned up temporary tile file ${tileTempImagePath}`);
                    } catch (cleanupError) {
                        console.warn(`Failed to clean up temporary tile file ${tileTempImagePath}:`, cleanupError);
                    }
                }
            }

            if (processedTiles === 0) {
                throw new Error('No tiles could be processed successfully');
            }

            let filteredOcrResults = this.filterOcrResults(allOcrResults);

            return filteredOcrResults;

        } catch (error) {
            throw error; // Let the calling function handle/re-throw
        }
    }

    /**
     * Create adaptive tiles based on file size and image dimensions.
     * Accepts either a file path or buffer as input.
     */
    private async createAdaptiveTiles(input: Buffer | string): Promise<{ tile: sharp.Sharp, startY: number }[]> {
        const image = sharp(input);
        const metadata = await image.metadata();

        const imgWidth = metadata.width!;
        const imgHeight = metadata.height!;
        const fileSize = input instanceof Buffer ? input.length : (await fs.stat(input)).size;

        console.log(`[createAdaptiveTiles] Image dimensions: ${imgWidth}x${imgHeight}, File size: ${fileSize / (1024 * 1024)}MB, Threshold: ${this.config.fileSizeThreshold / (1024 * 1024)}MB`);

        // For small images (less than 1MB), return a single tile
        if (fileSize < this.config.fileSizeThreshold) {
            return [{ tile: image, startY: 0 }];
        }

        // Calculate adaptive tile height based on excess file size
        const excessRatio = fileSize / this.config.fileSizeThreshold; // How many times over threshold
        const baseDivisions = Math.ceil(excessRatio);
        const overlapFactor = 1 - this.config.overlapPercentage; // 0.90 for 10% overlap
        const tileHeight = Math.floor(imgHeight / baseDivisions);

        // Ensure tile height is not too large

        console.log(`[createAdaptiveTiles] excessRatio: ${excessRatio}, baseDivisions: ${baseDivisions}, overlapFactor: ${overlapFactor}, tileHeight: ${tileHeight}`);

        const tiles: { tile: sharp.Sharp, startY: number }[] = [];
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

            tiles.push({ tile, startY });

            // Move startY for the next tile, accounting for overlap
            const overlapHeight = Math.floor(this.config.overlapPercentage * tileHeight);
            console.log(`[createAdaptiveTiles] Loop: startY: ${startY}, endY: ${endY}, actualTileHeight: ${actualTileHeight}, overlapHeight: ${overlapHeight}`);
            startY += tileHeight 

        }
        console.log(`[createAdaptiveTiles] Total tiles created: ${tiles.length}`);

        return tiles;
    }

    private filterOcrResults(data: OcrResultWithContext[]): OcrResult[] {
        // Create a map to store unique positions
        const positionMap = new Map<string, { entry: OcrResultWithContext; distance: number }>();
        
        for (const entry of data) {
            const key = `${entry.bbox.x},${entry.bbox.y}`;
            
            // Calculate distance from Y edges only
            const distanceFromTop = entry.bbox.y - entry.tileContext.y;
            const distanceFromBottom = (entry.tileContext.y + entry.tileContext.height) - (entry.bbox.y + entry.bbox.height);
            const distanceFromEdge = Math.min(distanceFromTop, distanceFromBottom);
            
            const existing = positionMap.get(key);
            if (!existing || distanceFromEdge > existing.distance) {
                positionMap.set(key, { entry, distance: distanceFromEdge });
            }
        }
        
        // Convert map values back to OcrResult array
        return Array.from(positionMap.values()).map(({ entry }) => ({
            text: entry.text,
            bbox: entry.bbox
        }));
    }
} 