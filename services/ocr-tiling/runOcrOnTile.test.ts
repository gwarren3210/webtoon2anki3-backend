import { runOcrOnTile } from '../ocr-tiling/runOcrOnTile';
import { Tile, OcrResult, BoundingBox } from '../ocr-tiling/types';

// Mock the @paddle-js-models/ocr package
const mockRecognize = jest.fn();
const mockInit = jest.fn();

jest.mock('@paddle-js-models/ocr', () => ({
  init: mockInit.mockResolvedValue(undefined),
  recognize: mockRecognize.mockResolvedValue({
    text: [],
    points: [],
  }),
}));

describe('runOcrOnTile', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    mockInit.mockClear();
    mockRecognize.mockClear();
  });

  it('should initialize the OCR engine', async () => {
    // Create a dummy tile
    const dummyTile: Tile = {
      image: Buffer.from('fake image data'),
      bbox: { x: 0, y: 0, width: 100, height: 100 },
    };

    await runOcrOnTile(dummyTile);

    // Expect init to have been called once
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('should call recognize with the tile image', async () => {
    const dummyTile: Tile = {
      image: Buffer.from('fake image data'),
      bbox: { x: 0, y: 0, width: 100, height: 100 },
    };

    await runOcrOnTile(dummyTile);

    // Expect recognize to have been called with the image buffer
    expect(mockRecognize).toHaveBeenCalledTimes(1);
    expect(mockRecognize).toHaveBeenCalledWith(dummyTile.image);
  });

  it('should map paddleocr results to OcrResult format', async () => {
    const dummyTile: Tile = {
      image: Buffer.from('fake image data'),
      bbox: { x: 0, y: 0, width: 100, height: 100 }, // Tile bbox won't affect unit test output, but is needed for type
    };

    // Define mock results from @paddle-js-models/ocr's recognize function
    const mockPaddleResults = {
      text: ['Hello', 'World'],
      points: [
        [[10, 10], [50, 10], [50, 20], [10, 20]], // Box for 'Hello'
        [[60, 30], [90, 30], [90, 40], [60, 40]], // Box for 'World'
      ],
    };

    // Configure the mock to return specific results
    mockRecognize.mockResolvedValue(mockPaddleResults);

    const ocrResults = await runOcrOnTile(dummyTile);

    // Expected OcrResult[] based on mockPaddleResults
    const expectedOcrResults: OcrResult[] = [
      {
        text: 'Hello',
        bbox: { x: 10, y: 10, width: 40, height: 10 },
        confidence: 1.0, // Default confidence
      },
      {
        text: 'World',
        bbox: { x: 60, y: 30, width: 30, height: 10 },
        confidence: 1.0, // Default confidence
      },
    ];

    expect(ocrResults).toEqual(expectedOcrResults);
  });

  it('should handle cases with no detected text', async () => {
    const dummyTile: Tile = {
      image: Buffer.from('fake image data'),
      bbox: { x: 0, y: 0, width: 100, height: 100 },
    };

    // Configure the mock to return no results
    const mockPaddleResults = {
      text: [],
      points: [],
    };
    mockRecognize.mockResolvedValue(mockPaddleResults);

    const ocrResults = await runOcrOnTile(dummyTile);

    // Expect an empty array
    expect(ocrResults).toEqual([]);
  });

  it('should handle cases with invalid points format', async () => {
    const dummyTile: Tile = {
      image: Buffer.from('fake image data'),
      bbox: { x: 0, y: 0, width: 100, height: 100 },
    };

    // Configure the mock to return results with invalid points (e.g., not 4 corners)
    const mockPaddleResults = {
      text: ['Text with bad box'],
      points: [
        [[10, 10], [50, 10], [50, 20]], // Missing one point
      ],
    };
    mockRecognize.mockResolvedValue(mockPaddleResults);

    // Spy on console.warn to check if the warning is logged
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const ocrResults = await runOcrOnTile(dummyTile);

    // Expect an empty array as the invalid result should be skipped
    expect(ocrResults).toEqual([]);

    // Expect console.warn to have been called
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping OCR result due to invalid points format'), expect.any(Array));

    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  it('should initialize the engine only once across multiple calls', async () => {
    const dummyTile1: Tile = {
      image: Buffer.from('fake image data 1'),
      bbox: { x: 0, y: 0, width: 100, height: 100 },
    };
    const dummyTile2: Tile = {
      image: Buffer.from('fake image data 2'),
      bbox: { x: 100, y: 0, width: 100, height: 100 },
    };

    // Call the function multiple times
    await runOcrOnTile(dummyTile1);
    await runOcrOnTile(dummyTile2);
    await runOcrOnTile(dummyTile1); // Call again

    // Expect init to have been called only once
    expect(mockInit).toHaveBeenCalledTimes(1);

    // Expect recognize to have been called for each call with the correct tile image
    expect(mockRecognize).toHaveBeenCalledTimes(3);
    expect(mockRecognize).toHaveBeenCalledWith(dummyTile1.image);
    expect(mockRecognize).toHaveBeenCalledWith(dummyTile2.image);
  });
}); 