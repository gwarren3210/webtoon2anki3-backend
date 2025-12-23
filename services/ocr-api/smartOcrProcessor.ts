import sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ocrSpace } from 'ocr-space-api-wrapper';
import { OcrResult, BoundingBox } from '../types'; // Import original types
import * as os from 'os';
import { randomUUID } from 'crypto';
import { getImageInfo, mapOcrSpaceResultToOcrResultArray, handleError, delay } from './ocrApiUtils'; // Import utilities
import log from 'encore.dev/log';
import { Secret, secret } from 'encore.dev/config';

// Define the OCR API key as a secret at the top level
const OCR_API_KEY = secret("OCR_API_KEY")();

/**
 * Configuration for OCR and tiling behavior
 */
export interface OCRConfig {
    apiKey?: string;
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
            apiKey: OCR_API_KEY,
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
        const tempImagePath = path.join(tempDir, `upload_${uniqueId}${getFileExtension(input)}`);

        try {
            log.info('Starting smart OCR processing', {
                inputType: typeof input,
                tempPath: tempImagePath
            });

            // Get file size and basic info
            const { fileSize, buffer } = await getImageInfo(input);
            log.info('Image info retrieved', {
                fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
                bufferSize: buffer.length
            });

            // Save buffer to a temporary file
            await fs.writeFile(tempImagePath, new Uint8Array(buffer));
            log.debug('Saved temporary image', { path: tempImagePath });

            // Check if we need to tile based on file size
            const needsTiling = fileSize > this.config.fileSizeThreshold;
            log.info('Tiling assessment', {
                needsTiling,
                fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
                thresholdMB: (this.config.fileSizeThreshold / 1024 / 1024).toFixed(2)
            });

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
            log.error('Error in OCR processing', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            handleError(error); // Use imported utility
            throw error; // Re-throw after handling
        } finally {
             // Clean up temporary file
             try {
                await fs.unlink(tempImagePath);
                log.debug('Cleaned up temporary image', { path: tempImagePath });
            } catch (cleanupError) {
                log.warn('Failed to clean up temporary image', {
                    path: tempImagePath,
                    error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                });
            }
        }
    }

    /**
     * Process image directly without tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private async processDirectly(input: string): Promise<OcrResult[]> {
        log.info('Processing image directly', { path: input });

        try {
            log.debug('Sending OCR request', {
                language: this.config.language,
                engine: this.config.ocrEngine
            });

            const ocrResult = await ocrSpace(input, {
                apiKey: this.config.apiKey,
                language: this.config.language as any,
                OCREngine: this.config.ocrEngine === 1 ? "1" : "2",
                scale: this.config.scale,
                isTable: false,
                isOverlayRequired: true,
            });

            // Defensive check for undefined response
            if (!ocrResult) {
                log.error('OCR API returned undefined - check API key and network');
                throw new Error('OCR API returned no response - check API key and network');
            }

            log.debug('Received OCR result', {
                exitCode: ocrResult.OCRExitCode,
                hasError: !!ocrResult.ErrorMessage
            });

            if (ocrResult.OCRExitCode === 1) {
                const results = mapOcrSpaceResultToOcrResultArray(ocrResult);
                log.info('Successfully processed image', {
                    resultCount: results.length
                });
                return results;
            } else {
                log.error('OCR processing failed', {
                    errorMessage: ocrResult.ErrorMessage || 'Unknown error'
                });
                throw new Error(`OCR failed: ${ocrResult.ErrorMessage || 'Unknown error'}`);
            }

        } catch (error) {
            log.error('Error in direct OCR processing', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error; // Let the calling function handle/re-throw
        }
    }

    /**
     * Process image with adaptive tiling.
     * Expects a file path as input.
     * Returns an array of OcrResult objects on success, throws error on failure.
     */
    private async processWithTiling(filePath: string): Promise<OcrResult[]> {
        log.info('Processing image with adaptive tiling', { path: filePath });

        const tempDir = os.tmpdir();
        const uniqueId = randomUUID();
        const allOcrResults: OcrResultWithContext[] = []; // Changed type here
        let processedTiles = 0;

        try {
            const image = sharp(filePath);
            const metadata = await image.metadata();
            const imgWidth = metadata.width!;
            const imgHeight = metadata.height!;

            log.info('Image metadata retrieved', {
                width: imgWidth,
                height: imgHeight
            });

            // Create tiles with adaptive height
            const tiles = await this.createAdaptiveTiles(filePath);
            log.info('Created adaptive tiles', { tileCount: tiles.length });

            // Process each tile
            for (const { tile, startY } of tiles) { // Destructure to get tile and startY
                log.info('Processing tile', { startY });

                const tileTempImagePath = path.join(tempDir, `tile_${uniqueId}_${startY}${getFileExtension(filePath)}`);
                try {
                    await tile.jpeg({ quality: 85 }).toFile(tileTempImagePath);
                    log.debug('Saved tile to temporary file', { path: tileTempImagePath });

                    const ocrResult = await ocrSpace(tileTempImagePath, {
                        apiKey: this.config.apiKey,
                        language: this.config.language as any,
                        OCREngine: this.config.ocrEngine === 1 ? "1" : "2",
                        scale: this.config.scale,
                        isTable: false,
                        isOverlayRequired: true,
                    });

                    // Defensive check for undefined response
                    if (!ocrResult) {
                        log.error('OCR API returned undefined', { startY });
                        throw new Error('OCR API returned no response - check API key and network');
                    }

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
                        log.warn('Tile OCR failed', {
                            startY,
                            errorMessage: ocrResult.ErrorMessage
                        });
                    }

                    // Add small delay to avoid rate limiting
                    await delay(500);

                } catch (tileError) {
                    log.error('Error processing tile', {
                        startY,
                        error: tileError instanceof Error ? tileError.message : String(tileError)
                    });
                } finally {
                    try {
                        await fs.unlink(tileTempImagePath);
                        log.debug('Cleaned up temporary tile file', { path: tileTempImagePath });
                    } catch (cleanupError) {
                        log.warn('Failed to clean up temporary tile file', {
                            path: tileTempImagePath,
                            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                        });
                    }
                }
            }

            if (processedTiles === 0) {
                log.error('No tiles processed successfully');
                throw new Error('No tiles could be processed successfully');
            }

            log.info('Completed tiled processing', {
                totalTiles: tiles.length,
                processedTiles,
                totalResults: allOcrResults.length
            });

            let filteredOcrResults = this.filterOcrResults(allOcrResults);
            log.info('Filtered OCR results', {
                beforeFilter: allOcrResults.length,
                afterFilter: filteredOcrResults.length
            });

            return filteredOcrResults;

        } catch (error) {
            log.error('Error in tiled OCR processing', {
                error: error instanceof Error ? error.message : String(error)
            });
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

        log.info('Image dimensions and file size', {
            width: imgWidth,
            height: imgHeight,
            fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
            thresholdMB: (this.config.fileSizeThreshold / 1024 / 1024).toFixed(2)
        });

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

        log.info('excessRatio, baseDivisions, overlapFactor, tileHeight', {
            excessRatio,
            baseDivisions,
            overlapFactor,
            tileHeight
        });

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
            log.debug('Loop: startY, endY, actualTileHeight, overlapHeight', {
                startY,
                endY,
                actualTileHeight,
                overlapHeight
            });
            startY += tileHeight 

        }
        log.info('Total tiles created', { tileCount: tiles.length });

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

// Helper function to get file extension from MIME type or file path
function getFileExtension(input: string | Buffer): string {
  if (typeof input === 'string') {
    // If it's a MIME type
    if (input.startsWith('image/')) {
      const mimeToExt: { [key: string]: string } = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp'
      };
      return mimeToExt[input] || '.jpg';
    }
    // If it's a file path, get extension from path
    const ext = path.extname(input).toLowerCase();
    return ext || '.jpg';
  }
  // Default to .jpg for Buffer input
  return '.jpg';
} 