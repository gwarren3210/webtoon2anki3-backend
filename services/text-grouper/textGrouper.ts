import { OcrResult, BoundingBox, OcrLineResult } from '../types';

/**
 * Groups OcrResult items into potential speech bubbles based on vertical proximity.
 * @param ocrData - Array of OcrResult objects.
 * @param verticalThreshold - Maximum vertical distance between text elements to be considered in the same group (default: 100).
 * @returns An array of arrays, where each inner array is a group of OcrResult objects.
 */
export function groupTextByProximity(
    ocrData: OcrResult[],
    verticalThreshold: number = 100
): OcrResult[][] {
    const sortedData = sortByVerticalPosition(ocrData);

    const groups: OcrResult[][] = [];
    let currentGroup: OcrResult[] = [];

    for (let i = 0; i < sortedData.length; i++) {
        const currentItem = sortedData[i];

        if (currentGroup.length === 0) {
            // Start new group
            currentGroup.push(currentItem);
        } else {
            // Check if current item is close enough to the last item in the group
            const lastItem = currentGroup[currentGroup.length - 1];
            const verticalDistance = Math.abs(currentItem.bbox.y - lastItem.bbox.y);

            if (verticalDistance <= verticalThreshold) {
                // Add to current group
                currentGroup.push(currentItem);
            } else {
                // Start new group
                groups.push([...currentGroup]);
                currentGroup = [currentItem];
            }
        }
    }

    // Don't forget the last group
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
}


/**
 * Sorts OcrResult items by y-coordinate.
 * @param ocrData - Array of OcrResult objects.
 * @returns Sorted array of OcrResult objects.
 */
function sortByVerticalPosition(ocrData: OcrResult[]): OcrResult[] {
    return [...ocrData].sort((a, b) => a.bbox.y - b.bbox.y);
}

/**
 * Sorts a group of OcrResult items by x-coordinate for proper reading order.
 * Sorts primarily by y-coordinate, with a tolerance based on median text height, then by x-coordinate.
 * @param group - Array of OcrResult objects within a group.
 * @param medianTextHeight - The median height of text elements in the group.
 * @param yToleranceRatio - The ratio of median text height to use as vertical tolerance (default: 0.2).
 * @returns Sorted array of OcrResult objects.
 */
export function sortGroupByHorizontalPosition(group: OcrResult[], medianTextHeight: number, yToleranceRatio: number = 0.2): OcrResult[] {
    const yTolerance = medianTextHeight * yToleranceRatio;
    // Sort primarily by y-coordinate, then by x-coordinate
    return group.sort((a, b) => {
        // If the absolute difference in y-coordinates is within the tolerance, sort by x
        if (Math.abs(a.bbox.y - b.bbox.y) <= yTolerance) {
            return a.bbox.x - b.bbox.x;
        }
        // Otherwise, sort by y
        return a.bbox.y - b.bbox.y;
    });
}

/**
 * Combines the text within a group of OcrResult items into a single string, sorted horizontally.
 * @param group - Array of OcrResult objects within a group.
 * @returns Combined text string.
 */
export function combineTextInGroup(group: OcrResult[]): string {
    if (group.length === 0) {
        return '';
    }

    // Calculate median text height for the group
    const heights = group.map(item => item.bbox.height).sort((a, b) => a - b);
    const medianHeight = heights.length % 2 === 0
        ? (heights[heights.length / 2 - 1] + heights[heights.length / 2]) / 2
        : heights[Math.floor(heights.length / 2)];

    // Use sortGroupByHorizontalPosition with the calculated median height
    return sortGroupByHorizontalPosition(group, medianHeight)
        .map(item => item.text)
        .join(' ');
}

/**
 * Calculates a bounding box that encompasses all given bounding boxes.
 * @param bboxes - Array of BoundingBox objects.
 * @returns A single BoundingBox encompassing all input boxes.
 * @throws Error if the input array is empty.
 */
export function calculateCombinedBoundingBox(bboxes: BoundingBox[]): BoundingBox {
    if (bboxes.length === 0) {
        throw new Error("Cannot calculate combined bounding box for an empty array.");
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const bbox of bboxes) {
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/**
 * Processes an array of OcrResult objects to group text by proximity and return combined lines with bounding boxes.
 * @param ocrResults - Array of OcrResult objects.
 * @param verticalThreshold - Vertical proximity threshold for grouping (default: 100).
 * @returns An array of OcrLineResult objects.
 */
export function processAndGroupOcrResults(
    ocrResults: OcrResult[],
    verticalThreshold: number = 100
): OcrLineResult[] {
    // 1. Group the OcrResult items by proximity
    const groupedResults = groupTextByProximity(ocrResults, verticalThreshold);

    // 2. Combine text and calculate combined bounding box for each group
    const finalOcrLineResults: OcrLineResult[] = groupedResults.map(group => ({
        line: combineTextInGroup(group),
        bbox: calculateCombinedBoundingBox(group.map(item => item.bbox)),
    }));

    return finalOcrLineResults;
}

// Example usage (can be removed later if not needed for utilities)
/*
async function exampleUsage() {
    // Assuming ocrData is loaded from somewhere, like the sample file
    const ocrData: OcrResult[] = [
        // ... load your data here ...
    ];

    const groupedText = groupTextByProximity(ocrData);

    console.log("=== GROUPED TEXT BY SPEECH BUBBLES/PROXIMITY ===\n");

    groupedText.forEach((group, index) => {
        const yRange = {
            min: Math.min(...group.map(item => item.bbox.y)),
            max: Math.max(...group.map(item => item.bbox.y + item.bbox.height))
        };

        console.log(`Speech Bubble ${index + 1}:`);
        console.log(`  Y-coordinate range: ${yRange.min} - ${yRange.max}`);
        console.log(`  Combined text: "${combineTextInGroup(group)}"`);
        console.log(`  Individual elements:`);

        group.forEach(item => {
            console.log(`    "${item.text}" at (${item.bbox.x}, ${item.bbox.y})`);
        });

        console.log("");
    });

    console.log("=== SUMMARY ===");
    groupedText.forEach((group, index) => {
        console.log(`${index + 1}. "${combineTextInGroup(group)}"`);
    });
}

// exampleUsage();
*/ 