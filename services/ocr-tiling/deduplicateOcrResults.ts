import { OcrResult, BoundingBox } from './types';

/**
 * Deduplicates overlapping OCR results.
 * @param results - Array of OCR results (from all tiles).
 * @param iouThreshold - IoU threshold for merging.
 * @returns Array of unique OCR results.
 */
export function deduplicateOcrResults(
  results: OcrResult[],
  iouThreshold: number = 0.5
): OcrResult[] {
  return deduplicateByIoU(results, iouThreshold);
}

/**
 * Helper to deduplicate OCR results using IoU and confidence.
 * @param results - Array of OCR results.
 * @param iouThreshold - IoU threshold.
 * @returns Array of unique OCR results.
 */
function deduplicateByIoU(
  results: OcrResult[],
  iouThreshold: number
): OcrResult[] {
  // Sort by confidence descending
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  const unique: OcrResult[] = [];

  for (const res of sorted) {
    if (
      unique.some(u =>
        calculateIoU(u.bbox, res.bbox) > iouThreshold
      )
    ) {
      continue; // Overlaps with a higher-confidence result
    }
    unique.push(res);
  }
  return unique;
}

/**
 * Calculates Intersection-over-Union (IoU) for two bounding boxes.
 * @param a - First bounding box.
 * @param b - Second bounding box.
 * @returns IoU value (0-1).
 */
function calculateIoU(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;
  return union === 0 ? 0 : intersection / union;
} 