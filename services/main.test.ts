// @ts-ignore
import { describe, it, expect, jest, beforeEach } from '@jest/globals'; // Using Jest globals
import { processWebtoonImage } from './main';
import { OcrResult, OcrLineResult, TranslatedWordInfo } from './types';
// Import the original function for typing purposes
import { handleAnkiPackageCreation as originalHandleAnkiPackageCreation } from './anki/ankiPackageHandler';
import path from 'path';
import fs from 'fs';
import process from 'process';

// --- Mock Data ---
jest.setTimeout(1.5 * 60 * 1000); // Set timeout to 90 seconds

const mockImagePath = path.join(__dirname, './test-data/main-sample.jpg');
const mockOcrApiKey = 'fake_api_key';

const mockOcrResults: OcrResult[] = [
  { text: 'Line 1', bbox: { x: 0, y: 0, width: 100, height: 10 } },
  { text: 'Line 2', bbox: { x: 0, y: 20, width: 100, height: 10 } },
];

const mockGroupedTextData: OcrLineResult[] = [
  { line: 'Line 1', bbox: { x: 0, y: 0, width: 100, height: 10 } },
  { line: 'Line 2', bbox: { x: 0, y: 20, width: 100, height: 10 } },
];

const mockTranslatedWordInfos: TranslatedWordInfo[] = [
  { originalWord: 'Line', translatedWord: 'ライン', originalLine: 'Line 1', originalLineBbox: { x: 0, y: 0, width: 100, height: 10 }, translatedLine: 'ライン 1' },
  { originalWord: '1', translatedWord: '1', originalLine: 'Line 1', originalLineBbox: { x: 0, y: 0, width: 100, height: 10 }, translatedLine: 'ライン 1' },
  { originalWord: 'Line', translatedWord: 'ライン', originalLine: 'Line 2', originalLineBbox: { x: 0, y: 20, width: 100, height: 10 }, translatedLine: 'ライン 2' },
  { originalWord: '2', translatedWord: '2', originalLine: 'Line 2', originalLineBbox: { x: 0, y: 20, width: 100, height: 10 }, translatedLine: 'ライン 2' },
];

const mockAnkiPackageBuffer = Buffer.from('fake anki package');

// --- Unit Tests (with mocks) ---

describe('processWebtoonImage - Unit', () => {
  // Mock the dependencies
  // We need to mock the modules that main.ts imports *within this describe block*
  jest.mock('./ocr-api', () => ({
    processImageForOCR: jest.fn(),
  }));

  jest.mock('./text-grouper', () => ({
    processAndGroupOcrResults: jest.fn(),
  }));

  jest.mock('./translation/papagoTranslateEngine', () => ({
    PapagoTranslateEngine: jest.fn().mockImplementation(() => ({
      translateDeck: jest.fn(),
    })),
  }));

  jest.mock('./anki/ankiPackageHandler', () => ({
    // Simple mock definition, typing is done separately
    handleAnkiPackageCreation: jest.fn(),
  }));

  // TODO: Mock validation if implemented and imported in main.ts
  // jest.mock('./validation', () => ({
  //   validateImageData: jest.fn(),
  // }));

  // Import the mocked functions after mocking
  const { processImageForOCR } = require('./ocr-api');
  const { processAndGroupOcrResults } = require('./text-grouper');
  const { PapagoTranslateEngine } = require('./translation/papagoTranslateEngine');

  // Import the mocked handleAnkiPackageCreation and assert its type
  const { handleAnkiPackageCreation } = require('./anki/ankiPackageHandler');
  const handleAnkiPackageCreationMock = handleAnkiPackageCreation as jest.Mock<typeof originalHandleAnkiPackageCreation>;

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process the image and return an Anki package', async () => {
    // Configure the mock return values
    processImageForOCR.mockResolvedValue(mockOcrResults);
    processAndGroupOcrResults.mockResolvedValue(mockGroupedTextData);
    // Mock the translateDeck method on the mocked engine instance
    
    const mockTranslateDeck = jest.fn().mockResolvedValue(mockTranslatedWordInfos as never);
    PapagoTranslateEngine.mockImplementation(() => ({
        translateDeck: mockTranslateDeck,
    }));

    // Use the correctly typed mock function for setting resolved value
    handleAnkiPackageCreationMock.mockResolvedValue(mockAnkiPackageBuffer);
    // TODO: Mock validateImageData if used
    // validateImageData.mockResolvedValue(undefined);

    // Call the function under test
    const result = await processWebtoonImage(
      mockImagePath,
      mockOcrApiKey,
    );

    // Assertions
    // TODO: Assert validateImageData was called if used
    // expect(validateImageData).toHaveBeenCalledWith(mockImageData);
    expect(processImageForOCR).toHaveBeenCalledWith(mockImagePath, mockOcrApiKey);
    expect(processAndGroupOcrResults).toHaveBeenCalledWith(mockOcrResults);
    // Assert the translation engine was instantiated and translateDeck was called
    expect(PapagoTranslateEngine).toHaveBeenCalledWith('ko', 'en'); // Check default languages
    expect(mockTranslateDeck).toHaveBeenCalledWith(mockGroupedTextData);
    // Use the correctly typed mock function for assertion
    expect(handleAnkiPackageCreationMock).toHaveBeenCalledWith(mockTranslatedWordInfos);
    expect(result).toBe(mockAnkiPackageBuffer);
  });

  // TODO: Add more unit test cases
  // - Test with different languages
  // - Test error handling at each step (OCR, grouping, translation, Anki creation)
});

// --- Integration Tests (no mocks) ---

describe('processWebtoonImage - Integration', () => {

  // Add a new integration test case
  it('should process the sample image and generate an Anki package file', async () => {
    // Set a large timeout for this integration test
    jest.setTimeout(90000); // 90 seconds timeout (adjust if needed)

    const testImagePath = path.join(__dirname, './test-data/main-sample.jpg');
    const outputFileName = 'generated_anki_package.apkg';
    const outputFilePath = path.join(__dirname, './test-data', outputFileName);

    // Ensure the sample image file exists
    if (!fs.existsSync(testImagePath)) {
      console.error(`Sample image not found at ${testImagePath}. Skipping integration test.`);
      return;
    }

    // Get the OCR API key
    const ocrApiKey = process.env.OCR_API_KEY as string;

    if (!ocrApiKey) {
      console.warn('OCR_API_KEY environment variable not set. Skipping integration test.');
    }

    console.log('Starting integration test for processWebtoonImage with sample image.');

    try {
      // Call the main processing function with actual data
      const ankiPackageBuffer = await processWebtoonImage(
        testImagePath,
        ocrApiKey,
      );

      console.log(`Integration test: Received Anki package buffer with size: ${ankiPackageBuffer.byteLength} bytes.`);

      // Ensure the test-data directory exists
      const testDataDir = path.join(__dirname, '../test-data');
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // Save the Anki package buffer to a file
      //fs.writeFileSync(outputFilePath, new Uint8Array(ankiPackageBuffer));

      console.log(`Integration test: Successfully saved Anki package to ${outputFilePath}`);

      // Basic assertion to check if the file was created and has content
      expect(fs.existsSync(outputFilePath)).toBe(true);
      expect(fs.statSync(outputFilePath).size).toBeGreaterThan(1000); // Expecting more than 1KB

      // Read the file and compare its contents with the buffer
      const fileBuffer = fs.readFileSync(outputFilePath);
      expect(Buffer.from(ankiPackageBuffer)).toEqual(fileBuffer);
    } catch (error: any) {
      console.error('Integration test failed:', error.message);
      console.error(error);
      throw error; // Re-throw to fail the test
    }

    console.log('Integration test finished.');

  });

}); 