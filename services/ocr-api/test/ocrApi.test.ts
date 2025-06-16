import { processImageForOCR } from '../index';
import * as dotenv from 'dotenv';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as path from 'path';
import { promises as fs } from 'fs';
import { SmartOCRProcessor } from '../smartOcrProcessor';
import { OcrResult } from '../../types';
import sharp from 'sharp';
//import { secret } from 'encore.dev/config';

dotenv.config();

// Mock the secret function to return the environment variable
jest.mock('encore.dev/config', () => ({
    secret: jest.fn((key: string) => {
        if (key === 'OCR_API_KEY') {
            return process.env.OCR_API_KEY;
        }
        throw new Error(`Unknown secret key: ${key}`);
    })
}));

describe('OCR API Integration Test', () => {
  it('should process an image and return OCR results', async () => {
    // Ensure your OCR_API_KEY environment variable is set.
    
    // Use path.resolve to get a reliable path to the test image from the test file's directory
    const testImagePath = path.resolve(__dirname, '../../../../', 'sample-images', 'main-sample.jpg');
    const apiKey = process.env.OCR_API_KEY;

    if (!apiKey) {
        console.error('OCR_API_KEY environment variable not set. Skipping test.');
        return;
    }
    console.log('testImagePath:', testImagePath);
    try {
      console.log(`\nProcessing image: ${testImagePath}`);
      const ocrResults = await processImageForOCR(testImagePath);

      // Define the path for the output file
      const outputPath = path.resolve(__dirname, '../../test-data/ocrOutputSample.json');
      
      // Write the OCR results to the file
      //fs.writeFileSync(outputPath, JSON.stringify(ocrResults, null, 2));
      //console.log(`OCR results saved to ${outputPath}`);

      console.log('\n--- OCR Results ---\n');
      console.log(JSON.stringify(ocrResults, null, 2));
      console.log('\n-------------------\n');

      // Basic assertion to check if results were returned
      expect(ocrResults.length).toBeGreaterThan(0)

    // Read the expected output file
    const expectedOutput = JSON.parse(await fs.readFile(outputPath, 'utf8'));
    
    // Compare the actual results with expected output
    expect(ocrResults).toEqual(expectedOutput);

    } catch (error) {
      console.error('Error during OCR API integration test:', error);
      throw error; // Re-throw the error to fail the test
    }
  }, 2 * 60 * 1000); // Increase timeout for API call
});

describe('SmartOCRProcessor Tiling Tests', () => {
    let processor: SmartOCRProcessor;

    beforeEach(() => {
        processor = new SmartOCRProcessor({
            fileSizeThreshold: 1024 * 1024, // 1MB
            overlapPercentage: 0.1, // 10% overlap
            language: 'kor',
            ocrEngine: 2,
            scale: true
        });
    });

    describe('createAdaptiveTiles', () => {
        it('should create tiles with correct dimensions and overlap', async () => {
            // Use the large-sample.jpg image for this test (1.8MB, should split into 2 tiles)
            const testImagePath = path.resolve(__dirname, '../../test-data', 'large-sample.jpg');
            const testImageBuffer = await fs.readFile(testImagePath);
            const tiles = await processor['createAdaptiveTiles'](testImageBuffer);
            
            // Expect exactly 2 tiles for this image
            expect(tiles.length).toBe(2);
            
            // Check that tiles have overlap
            const firstTile = tiles[0];
            const secondTile = tiles[1];

            // Ensure the second tile starts before the first tile ends (indicating overlap)
            const firstTileHeight = (await firstTile.tile.metadata()).height!;
            expect(secondTile.startY).toBeLessThan(firstTile.startY + firstTileHeight);

            // Ensure the second tile covers the remaining height
            const imageMetadata = await sharp(testImageBuffer).metadata();
            const imgHeight = imageMetadata.height!;
            const secondTileHeight = (await secondTile.tile.metadata()).height!;
            expect(secondTile.startY + secondTileHeight).toBeGreaterThanOrEqual(imgHeight);

            // Verify that each tile's size is less than the fileSizeThreshold
            for (const tile of tiles) {
                const tileBuffer = await tile.tile.toBuffer();
                expect(tileBuffer.length).toBeLessThan(processor['config'].fileSizeThreshold);
            }
            
        }, 60 * 1000); // Keep timeout at 60 seconds

        it('should handle small images without tiling', async () => {
            // Create a small test image using sharp
            const testImage = sharp({
                create: {
                    width: 100,
                    height: 100,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            });
            const testImageBuffer = await testImage.jpeg().toBuffer();
            
            const tiles = await processor['createAdaptiveTiles'](testImageBuffer);
            
            // Should create only one tile for a small image
            expect(tiles.length).toBe(1);
            expect(tiles[0].startY).toBe(0);
        });
    });
});

describe('SmartOCRProcessor Large Image OCR Test', () => {
        let processor: SmartOCRProcessor;

        beforeEach(() => {
            processor = new SmartOCRProcessor({
                fileSizeThreshold: 1024 * 1024, // 1MB
                overlapPercentage: 0.1, // 10% overlap
                language: 'kor',
                ocrEngine: 2,
                scale: true
            });
        });
        it('should process the large image with OCR and match saved results', async () => {
            const testImagePath = path.resolve(__dirname, '../../test-data', 'alternate-large-image.jpg');
            const expectedOutputPath = path.resolve(__dirname, '../../test-data', 'largeAltImageOcrOutput.json');

            console.log(`\nProcessing large image: ${testImagePath} for OCR...`);
            const ocrResults = await processor.processImage(testImagePath);

            expect(ocrResults.length).toBeGreaterThan(0);
            console.log(`OCR results obtained: ${ocrResults.length} entries.`);

            // Read the expected results
            const expectedResults = JSON.parse(await fs.readFile(expectedOutputPath, 'utf-8'));

            // Compare the results
            expect(ocrResults).toEqual(expectedResults);

            // Verify no duplicate positions
            const positionMap = new Map<string, OcrResult>();
            for (const result of ocrResults) {
                const key = `${result.bbox.x},${result.bbox.y}`;
                expect(positionMap.has(key)).toBe(false);
                positionMap.set(key, result);
            }
        }, 2 * 60 * 1000); // Increased timeout for potentially long OCR process

});

