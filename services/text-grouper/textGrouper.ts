import { OcrResult, BoundingBox, OcrLineResult } from '../types';
import log from 'encore.dev/log';

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
    log.info('Starting text grouping by proximity', {
        itemCount: ocrData.length,
        verticalThreshold
    });

    const sortedData = sortByVerticalPosition(ocrData);
    log.debug('Sorted data by vertical position', {
        firstItemY: sortedData[0]?.bbox.y,
        lastItemY: sortedData[sortedData.length - 1]?.bbox.y
    });

    const groups: OcrResult[][] = [];
    let currentGroup: OcrResult[] = [];

    for (let i = 0; i < sortedData.length; i++) {
        const currentItem = sortedData[i];

        if (currentGroup.length === 0) {
            currentGroup.push(currentItem);
            log.debug('Started new group', {
                itemText: currentItem.text,
                itemY: currentItem.bbox.y
            });
        } else {
            const lastItem = currentGroup[currentGroup.length - 1];
            const verticalDistance = Math.abs(currentItem.bbox.y - lastItem.bbox.y);

            if (verticalDistance <= verticalThreshold) {
                currentGroup.push(currentItem);
                log.debug('Added item to current group', {
                    itemText: currentItem.text,
                    verticalDistance,
                    groupSize: currentGroup.length
                });
            } else {
                groups.push([...currentGroup]);
                log.debug('Created new group', {
                    previousGroupSize: currentGroup.length,
                    totalGroups: groups.length
                });
                currentGroup = [currentItem];
            }
        }
    }

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
        log.debug('Added final group', {
            groupSize: currentGroup.length,
            totalGroups: groups.length
        });
    }

    log.info('Completed text grouping', {
        totalGroups: groups.length,
        averageGroupSize: groups.reduce((acc, group) => acc + group.length, 0) / groups.length
    });

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
    log.debug('Sorting group by horizontal position', {
        groupSize: group.length,
        medianTextHeight,
        yToleranceRatio
    });

    const yTolerance = medianTextHeight * yToleranceRatio;
    const sortedGroup = group.sort((a, b) => {
        if (Math.abs(a.bbox.y - b.bbox.y) <= yTolerance) {
            return a.bbox.x - b.bbox.x;
        }
        return a.bbox.y - b.bbox.y;
    });

    log.debug('Group sorted successfully', {
        firstItem: {
            text: sortedGroup[0]?.text,
            position: { x: sortedGroup[0]?.bbox.x, y: sortedGroup[0]?.bbox.y }
        },
        lastItem: {
            text: sortedGroup[sortedGroup.length - 1]?.text,
            position: { x: sortedGroup[sortedGroup.length - 1]?.bbox.x, y: sortedGroup[sortedGroup.length - 1]?.bbox.y }
        }
    });

    return sortedGroup;
}

/**
 * Combines the text within a group of OcrResult items into a single string, sorted horizontally.
 * @param group - Array of OcrResult objects within a group.
 * @returns Combined text string.
 */
export function combineTextInGroup(group: OcrResult[]): string {
    if (group.length === 0) {
        log.debug('Empty group, returning empty string');
        return '';
    }

    const heights = group.map(item => item.bbox.height).sort((a, b) => a - b);
    const medianHeight = heights.length % 2 === 0
        ? (heights[heights.length / 2 - 1] + heights[heights.length / 2]) / 2
        : heights[Math.floor(heights.length / 2)];

    log.debug('Calculated median height for group', {
        groupSize: group.length,
        medianHeight
    });

    const sortedGroup = sortGroupByHorizontalPosition(group, medianHeight);
    const combinedText = sortedGroup.map(item => item.text).join(' ');

    log.debug('Combined text in group', {
        groupSize: group.length,
        combinedTextLength: combinedText.length
    });

    return combinedText;
}

/**
 * Calculates a bounding box that encompasses all given bounding boxes.
 * @param bboxes - Array of BoundingBox objects.
 * @returns A single BoundingBox encompassing all input boxes.
 * @throws Error if the input array is empty.
 */
export function calculateCombinedBoundingBox(bboxes: BoundingBox[]): BoundingBox {
    if (bboxes.length === 0) {
        log.error('Attempted to calculate combined bounding box for empty array');
        throw new Error("Cannot calculate combined bounding box for an empty array.");
    }

    log.debug('Calculating combined bounding box', {
        boxCount: bboxes.length
    });

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

    const combinedBox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };

    log.debug('Calculated combined bounding box', {
        dimensions: combinedBox,
        originalBoxCount: bboxes.length
    });

    return combinedBox;
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
    log.info('Starting OCR results processing and grouping', {
        resultCount: ocrResults.length,
        verticalThreshold
    });

    const groupedResults = groupTextByProximity(ocrResults, verticalThreshold);
    log.info('Text grouped by proximity', {
        groupCount: groupedResults.length
    });

    const finalOcrLineResults: OcrLineResult[] = groupedResults.map((group, index) => {
        const line = combineTextInGroup(group);
        const bbox = calculateCombinedBoundingBox(group.map(item => item.bbox));
        
        log.debug('Processed group', {
            groupIndex: index,
            lineLength: line.length,
            bboxDimensions: bbox
        });

        return { line, bbox };
    });

    log.info('Completed OCR results processing', {
        inputCount: ocrResults.length,
        outputCount: finalOcrLineResults.length
    });

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