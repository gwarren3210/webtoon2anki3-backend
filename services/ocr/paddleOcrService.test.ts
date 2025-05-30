// @ts-nocheck
// Suppress type errors for test runner globals and implicit any in this test file.
import { runPaddleOcr } from './paddleOcrService';
import path from 'path';

describe('PaddleOCR Service - Ellipse Detection', () => {
  it('should detect 7 ovals/circles in the sample image', async () => {
    const imagePath = path.resolve('sample-images/row-1-column-1.jpg');
    const result = await runPaddleOcr(imagePath);
    const ellipses = result.regions.filter(r => r.region.type === 'ellipse');
    // Logging for debugging
    console.log(`Detected ${ellipses.length} ellipses.`);
    ellipses.forEach((e, i) => {
      console.log(`Ellipse ${i + 1}:`, e.region.boundingBox);
    });
    expect(ellipses).toHaveLength(7);
  });
}); 