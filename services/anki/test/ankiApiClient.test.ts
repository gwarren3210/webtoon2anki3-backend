// Jest test file for ankiApiClient.ts

import { buildAndDownloadAnkiPackage } from '../ankiApiClient';
import { TranslatedWordInfo } from '../../types';
import { describe, it, expect, jest } from '@jest/globals';
import * as path from 'path'
import * as fs from 'fs'
// Sample data matching the TranslatedWordInfo structure
const sampleTranslatedWordInfos: TranslatedWordInfo[] = [
  {
    korean: "안녕하세요",
    english: "Hello",
  },
  {
    korean: "감사합니다",
    english: "Thank you",
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

      // Expect the result to be an Buffer
      expect(apkgBytes).toBeInstanceOf(Buffer);

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

  it('should successfully create an Anki package with multiple words', async () => {
    const testWords = [
      { english: 'name', importanceScore: 75, korean: '이름' },
      { english: 'family name/surname', importanceScore: 65, korean: '성' },
      { english: 'Jinwoo (given name)', importanceScore: 65, korean: '진우' },
      { english: 'hunter', importanceScore: 95, korean: '헌터' },
      { english: 'class/grade/level', importanceScore: 85, korean: '급' },
      { english: 'association', importanceScore: 80, korean: '협회' },
      { english: 'affiliation/belonging', importanceScore: 70, korean: '소속' }
    ];

    const translatedWordInfos = testWords.map(word => ({
      korean: word.korean,
      english: word.english,
    }));

    const config = {
      front_fields: ["Korean"],
      back_fields: ["English"],
      create_duplicate: false
    }

    try {
      const apkgBytes = await buildAndDownloadAnkiPackage(translatedWordInfos, config);

      // Verify the response is an ArrayBuffer
      expect(apkgBytes).toBeInstanceOf(Buffer);

      // Write the ArrayBuffer to a file for inspection
      const testOutputDir = path.join(__dirname, 'test-output');
      
      // Create test-output directory if it doesn't exist
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir);
      }
      
      const outputPath = path.join(testOutputDir, `test-anki-package-${Date.now()}.apkg`);
      fs.writeFileSync(outputPath, Buffer.from(apkgBytes));
      console.log(`Test package written to: ${outputPath}`);
      // Verify the package has content
      expect(apkgBytes.byteLength).toBeGreaterThan(1000);

      console.log(`Test successful: Created Anki package with ${apkgBytes.byteLength} bytes for ${testWords.length} words.`);

    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });
  it('should create an Anki package with test data from ankiService', async () => {
    try {
      const testWords = [
        { english: 'name', importanceScore: 75, korean: '이름' },
        { english: 'family name/surname', importanceScore: 65, korean: '성' },
        { english: 'Jinwoo (given name)', importanceScore: 65, korean: '진우' },
        { english: 'hunter', importanceScore: 95, korean: '헌터' },
        { english: 'class/grade/level', importanceScore: 85, korean: '급' },
        { english: 'association', importanceScore: 80, korean: '협회' },
        { english: 'affiliation/belonging', importanceScore: 70, korean: '소속' }
      ];

      const translatedWordInfos = testWords.map(word => ({
        korean: word.korean,
        english: word.english,
      }));

      const config = {
        front_fields: ["Original Word"],
        back_fields: ["Translated Word"],
        create_duplicate: true
      };

      const ankiPackage = await buildAndDownloadAnkiPackage(translatedWordInfos, config);
      
      // Verify the response is a Buffer
      expect(ankiPackage).toBeInstanceOf(Buffer);
      
      // Verify the package has content
      expect(ankiPackage.byteLength).toBeGreaterThan(1000);
      
      // Write the package to a file for inspection
      const testOutputDir = path.join(__dirname, 'test-output');
      
      // Create test-output directory if it doesn't exist
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir);
      }
      
      const outputPath = path.join(testOutputDir, `test-anki-package-service-${Date.now()}.apkg`);
      fs.writeFileSync(outputPath, Buffer.from(ankiPackage));
      console.log(`Test package written to: ${outputPath}`);
      
      console.log(`Test successful: Created Anki package with ${ankiPackage.byteLength} bytes from ankiService.`);
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });

  it('should create an Anki package via API endpoint', async () => {
    try {
      const ANKI_BUILDER_SERVICE_URL = 'https://anki-builder-530177289872.us-central1.run.app';
      const testWords = [
        { english: 'name', importanceScore: 75, korean: '이름' },
        { english: 'family name/surname', importanceScore: 65, korean: '성' },
        { english: 'Jinwoo (given name)', importanceScore: 65, korean: '진우' },
        { english: 'hunter', importanceScore: 95, korean: '헌터' },
        { english: 'class/grade/level', importanceScore: 85, korean: '급' },
        { english: 'association', importanceScore: 80, korean: '협회' },
        { english: 'affiliation/belonging', importanceScore: 70, korean: '소속' }
      ];

      const translatedWordInfos = testWords.map(word => ({
        originalWord: word.korean,
        originalLine: word.korean,
        translatedWord: word.english,
        translatedLine: word.english,
        originalLineBbox: {
          x: 0,
          y: 0,
          width: 100,
          height: 20
        }
      }));

      const requestBody = {
        translated_word_infos: translatedWordInfos,
        config: {
          front_fields: ["Original Word"],
          back_fields: ["Translated Word"],
          create_duplicate: true
        }
      };

      const response = await fetch(`${ANKI_BUILDER_SERVICE_URL}/build-package`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const ankiPackage = await response.arrayBuffer();
      
      // Verify the response is an ArrayBuffer
      expect(ankiPackage).toBeInstanceOf(ArrayBuffer);
      
      // Verify the package has content
      expect(ankiPackage.byteLength).toBeGreaterThan(1000);
      
      // Write the package to a file for inspection
      const testOutputDir = path.join(__dirname, 'test-output');
      
      // Create test-output directory if it doesn't exist
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir);
      }
      
      const outputPath = path.join(testOutputDir, `test-anki-package-api-${Date.now()}.apkg`);
      fs.writeFileSync(outputPath, Buffer.from(ankiPackage));
      console.log(`Test package written to: ${outputPath}`);
      
      console.log(`Test successful: Created Anki package with ${ankiPackage.byteLength} bytes via API endpoint.`);
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });
