import { Tile, OcrResult } from './types';
import * as ocr from '@paddle-js-models/ocr';

// Promise to hold the initialization state
let initializationPromise: Promise<void> | null = null;

/**
 * Initializes the PaddleOCR engine if not already initialized.
 */
async function initializeOcrEngine(): Promise<void> {
  if (!initializationPromise) {
    // Model loading can take time, especially on first run.
    // Consider adding logging or progress indication here.
    initializationPromise = ocr.init();
  }
  return initializationPromise;
}

/**
 * Runs OCR on a single tile using @paddle-js-models/ocr.
 * @param tile - The tile to process.
 * @returns Promise resolving to an array of OCR results (text, bbox, confidence).
 */
export async function runOcrOnTile(tile: Tile): Promise<OcrResult[]> {
  // Ensure the OCR engine is initialized
  await initializeOcrEngine();

  // Call the OCR function from the package.
  // The package's recognize function expects an image source (like a Buffer, ImageData, or image element).
  // Based on documentation, it returns an object with `text: string[]` and `points: number[][][]`
  // where text[i] corresponds to the points[i] bounding box.
  const results: { text: string[]; points: number[][][]; } = await ocr.recognize(tile.image);

  const ocrResults: OcrResult[] = [];

  // Iterate over the detected text regions and create OcrResult objects.
  // Assuming results.text and results.points are arrays of the same length,
  // where each index corresponds to a detected text region.
  for (let i = 0; i < results.text.length; i++) {
    const text = results.text[i];
    const points = results.points[i]; // points for a single bounding box: number[][]

    // Convert the array of points (4 corners) to your { x, y, width, height } bbox format.
    // Ensure there are exactly 4 points (corners) for a valid rectangle.
    if (points && points.length === 4) {
        const x = Math.min(...points.map(p => p[0]));
        const y = Math.min(...points.map(p => p[1]));
        const width = Math.max(...points.map(p => p[0])) - x;
        const height = Math.max(...points.map(p => p[1])) - y;

        ocrResults.push({
            text: text,
            bbox: { x, y, width, height },
            confidence: 1.0, // The documentation doesn't provide a confidence score, default to 1.0
        });
    } else {
        // Handle cases where points might be missing or not in the expected format
        console.warn(`Skipping OCR result due to invalid points format at index ${i}:`, points);
    }
  }

  return ocrResults;
}

/**
 * Stub for OCR engine integration.
 * Replace with actual OCR logic (e.g., PaddleOCR, Tesseract).
 * @param tile - The tile to process.
 * @returns Array of OCR results.
 */
// Removed the old synchronous stub
// function runOcrEngineStub(tile: Tile): OcrResult[] {
//   // Placeholder: returns a dummy result for demonstration.
//   return [
//     {
//       text: 'dummy text',
//       bbox: { x: 0, y: 0, width: tile.bbox.width, height: tile.bbox.height },
//       confidence: 1.0,
//     },
//   ];
// } 