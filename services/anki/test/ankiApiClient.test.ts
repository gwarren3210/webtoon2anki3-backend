// Jest test file for ankiApiClient.ts

import { buildAndDownloadAnkiPackage } from '../ankiApiClient';
import { TranslatedWordInfo } from '../../types';
import { describe, it, expect, jest } from '@jest/globals';

// Sample data matching the TranslatedWordInfo structure
const sampleTranslatedWordInfos: TranslatedWordInfo[] = [
  {
    originalWord: "안녕하세요",
    originalLine: "안녕하세요",
    translatedWord: "Hello",
    translatedLine: "Hello",
    originalLineBbox: {
      x: 1,
      y: 1,
      width: 1,
      height: 1,
    },
  },
  {
    originalWord: "감사합니다",
    originalLine: "정말 감사합니다!",
    translatedWord: "Thank you",
    translatedLine: "Thank you very much!",
    originalLineBbox: {
      x: 1,
      y: 1,
      width: 1,
      height: 1,
    },
  }
];

// NOTE: This is an integration test that requires the Anki builder microservice to be running
// and accessible at the URL defined in ankiApiClient.ts. For a unit test, you would mock axios.

describe('buildAndDownloadAnkiPackage', () => {

  // Set a higher timeout for this integration test
  jest.setTimeout(30000); // 30 seconds timeout

  it('should successfully call the microservice and return an ArrayBuffer', async () => {
    try {
      const apkgBytes = await buildAndDownloadAnkiPackage(sampleTranslatedWordInfos);

      // Expect the result to be an ArrayBuffer
      expect(apkgBytes).toBeInstanceOf(ArrayBuffer);

      // Expect the ArrayBuffer to have some content (a non-zero byte length)
      // A minimal .apkg file will still have a significant byte size due to the SQLite DB structure.
      expect(apkgBytes.byteLength).toBeGreaterThan(1000); // Expecting more than 1KB, adjust if necessary based on actual output

      console.log(`Test successful: Received Anki package with ${apkgBytes.byteLength} bytes.`);

      // Optional: Save the received ArrayBuffer to a file for manual verification
      // import * as fs from 'fs';
      // fs.writeFileSync('./test_output_anki_package.apkg', Buffer.from(apkgBytes));
      // console.log('Test Anki package saved to test_output_anki_package.apkg');

    } catch (error) {
      console.error('Test failed:', error);
      // If the microservice is not running, this test will likely throw.
      // For a real test suite, you might conditionally skip or mock this.
      throw error; // Re-throw to make the test fail
    }
  });

  // You could add more tests here, e.g., for error cases
  // it('should handle an empty input array', async () => { ... });
  // it('should handle invalid data format (if validation is added)', async () => { ... });

}); 