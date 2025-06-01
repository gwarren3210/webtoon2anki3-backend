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
/**
 * Information about a translated word, its original context, and optional line translation.
 */
export type TranslatedWordInfo = {
    originalWord: string;
    originalWordBbox?: BoundingBox;
    originalLine: string;
    originalLineBbox: BoundingBox;
    translatedWord: string;
    translatedLine?: string;
};
