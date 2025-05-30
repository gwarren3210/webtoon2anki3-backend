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
  confidence: number;
};

/**
 * Tile metadata and image data.
 */
export type Tile = {
  image: Buffer;
  bbox: BoundingBox;
}; 