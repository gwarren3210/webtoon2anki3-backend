import { processWebtoonImage } from './main';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration and Input Data ---

const mockImageData: Buffer = fs.readFileSync(path.join(__dirname, '../test-data/sample-webtoon-image.png'));

const mockOcrApiKey: string = process.env.OCR_API_KEY || ''; // Replace with your key

// Optional: Specify source and target languages if different from defaults
const sourceLang = 'ko';
const targetLang = 'en';

// Define the output path for the generated Anki package
const outputDir = path.join(__dirname, '../../output');
const outputFileName = 'webtoon_anki_package.apkg';
const outputFilePath = path.join(outputDir, outputFileName);

// --- Test Execution ---

async function runTest() {
  console.log('Starting test for processWebtoonImage...');

  try {
    // Call the main processing function
    const ankiPackageBuffer = await processWebtoonImage(
      mockImageData,
      mockOcrApiKey,
      sourceLang,
      targetLang
    );

    console.log(`Received Anki package buffer with size: ${ankiPackageBuffer.byteLength} bytes.`);

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save the Anki package buffer to a file
    fs.writeFileSync(outputFilePath, new Uint8Array(ankiPackageBuffer));

    console.log(`Successfully saved Anki package to ${outputFilePath}`);

  } catch (error: any) {
    console.error('Test failed:', error.message);
    console.error(error);
  }

  console.log('Test finished.');
}

// Execute the test function
runTest(); 