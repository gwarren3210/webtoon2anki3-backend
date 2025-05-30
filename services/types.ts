/**
 * Rectangle bounding box in image coordinates.
 */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * OCR result for a region.
 */
export type OcrResult = {
  text: string;
  bbox: BoundingBox;
};

/**
 * OCR result for a grouped line.
 */
export type OcrLineResult = {
  line: string;
  bbox: BoundingBox;
};
