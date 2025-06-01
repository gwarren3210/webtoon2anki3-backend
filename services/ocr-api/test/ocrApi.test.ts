import { processImageForOCR } from '../index';
import * as dotenv from 'dotenv';
import { describe, it, expect } from '@jest/globals'; // Explicitly import test functions
import * as path from 'path'; // Import path module
import * as fs from 'fs'; // Import file system module

dotenv.config(); // Load environment variables

describe('OCR API Integration Test', () => {
  it('should process an image and return OCR results', async () => {
    // Ensure your OCR_API_KEY environment variable is set.
    
    // Use path.resolve to get a reliable path to the test image from the test file's directory
    const testImagePath = path.resolve(__dirname, '../../../../', 'sample-images', 'main-sample.jpg');
    const apiKey = process.env.OCR_API_KEY;

    if (!apiKey) {
        console.error('OCR_API_KEY environment variable not set. Skipping test.');
        return;
    }
    console.log('testImagePath:', testImagePath);
    try {
      console.log(`\nProcessing image: ${testImagePath}`);
      const ocrResults = await processImageForOCR(testImagePath, apiKey);

      // Define the path for the output file
      const outputPath = path.resolve(__dirname, '../../test-data/ocrOutputSample.json');
      
      // Write the OCR results to the file
      //fs.writeFileSync(outputPath, JSON.stringify(ocrResults, null, 2));
      //console.log(`OCR results saved to ${outputPath}`);

      console.log('\n--- OCR Results ---\n');
      console.log(JSON.stringify(ocrResults, null, 2));
      console.log('\n-------------------\n');

      // Basic assertion to check if results were returned
      expect(ocrResults.length).toBeGreaterThan(0)

    // Read the expected output file
    const expectedOutput = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    
    // Compare the actual results with expected output
    expect(ocrResults).toEqual(expectedOutput);

    } catch (error) {
      console.error('Error during OCR API integration test:', error);
      throw error; // Re-throw the error to fail the test
    }
  }, 2 * 60 * 1000); // Increase timeout for API call
}); 