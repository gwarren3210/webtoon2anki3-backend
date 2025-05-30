//@ts-nocheck
import cv from 'opencv4nodejs';

/**
 * Type of detected speech bubble region.
 */
export type RegionType = 'rectangle' | 'ellipse';

/**
 * Bounding box for a detected region.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A detected speech bubble region (rectangle or ellipse).
 */
export interface DetectedRegion {
  type: RegionType;
  boundingBox: BoundingBox;
  // Optionally: ellipse params, polygon points, etc.
}

/**
 * OCR result for a single region.
 */
export interface RegionOcrResult {
  region: DetectedRegion;
  text: string;
}

/**
 * OCR result for the whole image.
 */
export interface OcrResult {
  regions: RegionOcrResult[];
}

/**
 * Runs OCR on the provided image file using PaddleOCR (TypeScript implementation).
 * Detects both rectangular and oval (ellipse) speech bubbles.
 * @param imagePath - Absolute path to the image file
 * @returns Promise<OcrResult> - The extracted text and metadata
 */
export async function runPaddleOcr(imagePath: string): Promise<OcrResult> {
  // Orchestrates the OCR process (no logic here)
  return await _runPaddleOcrImpl(imagePath);
}

// --- Implementation below ---

/**
 * Helper function that performs the actual OCR logic using PaddleOCR in TypeScript.
 * Detects rectangles and ellipses, crops regions, and (placeholder) runs OCR.
 * @param imagePath - Absolute path to the image file
 * @returns Promise<OcrResult>
 */
async function _runPaddleOcrImpl(imagePath: string): Promise<OcrResult> {
  const image = cv.imread(imagePath);
  const gray = image.bgrToGray();
  const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);
  const edges = blurred.canny(50, 150);
  const contours = edges.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const regions: DetectedRegion[] = [];

  for (const cnt of contours) {
    // Rectangle detection
    const approx = cnt.approxPolyDP(0.02 * cnt.arcLength(true), true);
    if (approx.length === 4 && cnt.isConvex) {
      const rect = cnt.boundingRect();
      regions.push({ type: 'rectangle', boundingBox: rect });
      continue;
    }
    // Ellipse detection
    if (cnt.numPoints >= 5) {
      const ellipse = cnt.fitEllipse();
      const aspect = ellipse.size.width / ellipse.size.height;
      if (aspect > 0.5 && aspect < 2.0) {
        regions.push({
          type: 'ellipse',
          boundingBox: {
            x: ellipse.center.x - ellipse.size.width / 2,
            y: ellipse.center.y - ellipse.size.height / 2,
            width: ellipse.size.width,
            height: ellipse.size.height,
          },
        });
      }
    }
  }

  // For each region, crop and run OCR (placeholder for now)
  const regionResults: RegionOcrResult[] = regions.map(region => {
    // Crop region from image
    const { x, y, width, height } = region.boundingBox;
    const roi = image.getRegion(new cv.Rect(x, y, width, height));
    // TODO: Replace with actual OCR logic
    const text = '[OCR not implemented]';
    return { region, text };
  });

  return { regions: regionResults };
} 