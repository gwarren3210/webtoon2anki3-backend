import { OcrResult, BoundingBox, OcrLineResult } from '../types';
/**
 * Groups OcrResult items into potential speech bubbles based on vertical proximity.
 * @param ocrData - Array of OcrResult objects.
 * @param verticalThreshold - Maximum vertical distance between text elements to be considered in the same group (default: 100).
 * @returns An array of arrays, where each inner array is a group of OcrResult objects.
 */
export declare function groupTextByProximity(ocrData: OcrResult[], verticalThreshold?: number): OcrResult[][];
/**
 * Sorts a group of OcrResult items by x-coordinate for proper reading order.
 * Sorts primarily by y-coordinate, with a tolerance based on median text height, then by x-coordinate.
 * @param group - Array of OcrResult objects within a group.
 * @param medianTextHeight - The median height of text elements in the group.
 * @param yToleranceRatio - The ratio of median text height to use as vertical tolerance (default: 0.2).
 * @returns Sorted array of OcrResult objects.
 */
export declare function sortGroupByHorizontalPosition(group: OcrResult[], medianTextHeight: number, yToleranceRatio?: number): OcrResult[];
/**
 * Combines the text within a group of OcrResult items into a single string, sorted horizontally.
 * @param group - Array of OcrResult objects within a group.
 * @returns Combined text string.
 */
export declare function combineTextInGroup(group: OcrResult[]): string;
/**
 * Calculates a bounding box that encompasses all given bounding boxes.
 * @param bboxes - Array of BoundingBox objects.
 * @returns A single BoundingBox encompassing all input boxes.
 * @throws Error if the input array is empty.
 */
export declare function calculateCombinedBoundingBox(bboxes: BoundingBox[]): BoundingBox;
/**
 * Processes an array of OcrResult objects to group text by proximity and return combined lines with bounding boxes.
 * @param ocrResults - Array of OcrResult objects.
 * @param verticalThreshold - Vertical proximity threshold for grouping (default: 100).
 * @returns An array of OcrLineResult objects.
 */
export declare function processAndGroupOcrResults(ocrResults: OcrResult[], verticalThreshold?: number): OcrLineResult[];
