import { groupTextByProximity, combineTextInGroup, calculateCombinedBoundingBox, processAndGroupOcrResults, getDialogueFromGroupedText } from '../textGrouper';
import { OcrResult, OcrLineResult } from '../../types';
import { describe, it, expect } from '@jest/globals'; // Explicitly import test functions
import * as fs from 'fs/promises';
import * as path from 'path';

const SAMPLE_INPUT_PATH = path.join(__dirname, '../../test-data/ocrOutputSample.json');
const SAMPLE_OUTPUT_PATH = path.join(__dirname, '../../test-data/ocrGroupedOutputSample.json');

describe('processAndGroupOcrResults', () => {
    // Sample OcrResult data for testing
    const sampleOcrResults: OcrResult[] = [
        { text: 'Hello', bbox: { x: 10, y: 10, width: 50, height: 20 } },
        { text: 'World', bbox: { x: 70, y: 10, width: 50, height: 20 } },
        { text: 'This', bbox: { x: 15, y: 40, width: 40, height: 20 } },
        { text: 'is', bbox: { x: 60, y: 40, width: 20, height: 20 } },
        { text: 'a', bbox: { x: 85, y: 40, width: 15, height: 20 } },
        { text: 'test', bbox: { x: 105, y: 40, width: 40, height: 20 } },
        { text: 'Another', bbox: { x: 20, y: 100, width: 60, height: 20 } },
        { text: 'line', bbox: { x: 90, y: 100, width: 40, height: 20 } },
        { text: 'far', bbox: { x: 10, y: 200, width: 30, height: 20 } },
        { text: 'away', bbox: { x: 50, y: 200, width: 40, height: 20 } },
    ];

    it('should group OcrResult objects by proximity and format as OcrLineResult', () => {
        const groupedResults: OcrLineResult[] = processAndGroupOcrResults(sampleOcrResults, 30); // Use a vertical threshold

        // Define the expected output based on the sample data and threshold
        const expectedOutput: OcrLineResult[] = [
            { line: 'Hello World This is a test', bbox: { x: 10, y: 10, width: 135, height: 50 } }, // Combined bbox for Hello, World, This, is, a, test
            { line: 'Another line', bbox: { x: 20, y: 100, width: 110, height: 20 } }, // Combined bbox for Another and line
            { line: 'far away', bbox: { x: 10, y: 200, width: 80, height: 20 } }, // Combined bbox for far and away
        ];

        // Expect the number of grouped lines to match
        expect(groupedResults.length).toBe(expectedOutput.length);

        console.log(groupedResults)

        // Expect each grouped line to have the correct text and a reasonable bounding box
        groupedResults.forEach((lineResult, index) => {
            expect(lineResult.line).toBe(expectedOutput[index].line);
            // Basic check for bounding box - a more detailed check could verify min/max coordinates
            expect(lineResult.bbox).toEqual(expectedOutput[index].bbox);
        });
    });

    it('should handle empty input array', () => {
        const groupedResults = processAndGroupOcrResults([], 100);
        expect(groupedResults).toEqual([]);
    });

    it('should process ocrOutputSample.json and match expected output', async () => {
        try {
            // Read sample OCR data and expected output
            const rawData = await fs.readFile(SAMPLE_INPUT_PATH, 'utf-8');
            const expectedData = await fs.readFile(SAMPLE_OUTPUT_PATH, 'utf-8');
            const ocrResults: OcrResult[] = JSON.parse(rawData);
            const expectedResults: OcrLineResult[] = JSON.parse(expectedData);

            // Process and group the OCR results
            const verticalThreshold = 80;
            const groupedResults: OcrLineResult[] = processAndGroupOcrResults(ocrResults, verticalThreshold);

            // Compare results with expected output
            try {
                expect(groupedResults).toEqual(expectedResults);
            } catch (error) {
                // If test fails, write the actual results to a new file for comparison
                const failedOutputPath = SAMPLE_OUTPUT_PATH.replace('.json', '.failed.json');
                await fs.writeFile(failedOutputPath, JSON.stringify(groupedResults, null, 2), 'utf-8');
                console.error(`Test failed. Actual results written to ${failedOutputPath}`);
                throw error;
            }

        } catch (error) {
            console.error('Error processing sample JSON:', error);
            throw error;
        }
    });

    // Add more test cases for different vertical thresholds, edge cases, etc.
});

// New test cases for individual utility functions
describe('Text Grouping Utility Functions', () => {
    const sampleData: OcrResult[] = [
        { text: 'Item1', bbox: { x: 10, y: 10, width: 50, height: 20 } },
        { text: 'Item2', bbox: { x: 70, y: 12, width: 50, height: 20 } }, // Close vertically
        { text: 'Item3', bbox: { x: 15, y: 50, width: 50, height: 20 } }, // Further vertically
        { text: 'Item4', bbox: { x: 80, y: 52, width: 50, height: 20 } }, // Close vertically to Item3
    ];

    it('groupTextByProximity should group items based on vertical threshold', () => {
        const threshold = 30; // Example threshold
        const groups = groupTextByProximity(sampleData, threshold);

        expect(groups.length).toBe(2); // Expecting two groups
        expect(groups[0].length).toBe(2); // First group should have 2 items
        expect(groups[1].length).toBe(2); // Second group should have 2 items

        // Check if items are correctly grouped (order might vary initially before horizontal sort)
        const group1Texts = groups[0].map(item => item.text).sort().join(' ');
        const group2Texts = groups[1].map(item => item.text).sort().join(' ');

        expect([group1Texts, group2Texts]).toEqual(expect.arrayContaining(['Item1 Item2', 'Item3 Item4']));

        // Test with a larger threshold, should result in one group
        const largeThreshold = 100;
        const singleGroup = groupTextByProximity(sampleData, largeThreshold);
        expect(singleGroup.length).toBe(1);
        expect(singleGroup[0].length).toBe(4);
    });

    it('combineTextInGroup should combine text horizontally and sort', () => {
        const group: OcrResult[] = [
            { text: 'World', bbox: { x: 70, y: 10, width: 50, height: 20 } },
            { text: 'Hello', bbox: { x: 10, y: 10, width: 50, height: 20 } },
        ];
        const combined = combineTextInGroup(group);
        expect(combined).toBe('Hello World');
    });

    it('calculateCombinedBoundingBox should calculate a bounding box encompassing all inputs', () => {
        const bboxes = [
            { x: 10, y: 10, width: 50, height: 20 },
            { x: 70, y: 10, width: 50, height: 20 },
            { x: 15, y: 40, width: 40, height: 20 },
        ];
        const combinedBbox = calculateCombinedBoundingBox(bboxes);

        expect(combinedBbox.x).toBe(10);
        expect(combinedBbox.y).toBe(10);
        expect(combinedBbox.width).toBe(70 + 50 - 10); // maxX - minX
        expect(combinedBbox.height).toBe(40 + 20 - 10); // maxY - minY
    });

    it('calculateCombinedBoundingBox should throw an error for empty input', () => {
        expect(() => calculateCombinedBoundingBox([])).toThrow('Cannot calculate combined bounding box for an empty array.');
    });
}); 

describe('getDialogueFromGroupedText', () => {
    it('should extract dialogue and add line breaks', () => {
        const groupedTextData: OcrLineResult[] = [
            { line: 'Hello', bbox: { x: 10, y: 10, width: 50, height: 20 } },
            { line: 'World', bbox: { x: 10, y: 40, width: 50, height: 20 } },
            { line: '   ', bbox: { x: 10, y: 70, width: 50, height: 20 } }, // Empty line
            { line: 'How are you?', bbox: { x: 10, y: 100, width: 50, height: 20 } }
        ];

        const dialogue = getDialogueFromGroupedText(groupedTextData);

        expect(dialogue).toEqual([
            'Hello\n',
            'World\n',
            'How are you?\n'
        ]);
    });

    it('should handle empty input', () => {
        const emptyInput: OcrLineResult[] = [];
        const dialogue = getDialogueFromGroupedText(emptyInput);
        expect(dialogue).toEqual([]);
    });

    it('should filter out empty lines', () => {
        const groupedTextData: OcrLineResult[] = [
            { line: '   ', bbox: { x: 10, y: 10, width: 50, height: 20 } },
            { line: '', bbox: { x: 10, y: 40, width: 50, height: 20 } },
            { line: 'Valid text', bbox: { x: 10, y: 70, width: 50, height: 20 } }
        ];

        const dialogue = getDialogueFromGroupedText(groupedTextData);

        expect(dialogue).toEqual(['Valid text\n']);
    });
});

describe.only('Export dialogue from full-ocr.json', () => {
    it('should write dialogue lines from groupedResults to full-ocr.dialogue.txt', async () => {
        const fullOcrPath = path.join(__dirname, '../../test-data/full-ocr.json');
        const dialogueOutPath = path.join(__dirname, '../../test-data/full-ocr.dialogue.txt');
        const raw = await fs.readFile(fullOcrPath, 'utf-8');
        const json = JSON.parse(raw);
        const groupedResults = json.groupedResults;
        const dialogueLines = getDialogueFromGroupedText(groupedResults);
        await fs.writeFile(dialogueOutPath, dialogueLines.join(''), 'utf-8');
    });
});
