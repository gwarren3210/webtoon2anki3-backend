import { processWebtoonImage } from './main';
import { promises as fs } from 'fs'; // Use promise-based fs
import * as path from 'path';

// --- Configuration and Input Data ---

const mockImagePath: string = path.join(__dirname, '../test-data/sample-webtoon-image.png');
const mockLargeImagePath: string = path.join(__dirname, '../test-data/alternate-large-image.jpg'); // New path for large image

const mockOcrApiKey: string = process.env.OCR_API_KEY || ''; // Replace with your key

// Optional: Specify source and target languages if different from defaults
const sourceLang = 'ko';
const targetLang = 'en';

// Define the output path for the generated Anki package for small image
const outputDir = path.join(__dirname, '../../output');
const outputFileName = 'webtoon_anki_package.apkg';
const outputFilePath = path.join(outputDir, outputFileName);

// Define the output path for the generated Anki package for large image
const outputLargeFileName = 'webtoon_anki_large_package.apkg';
const outputLargeFilePath = path.join(outputDir, outputLargeFileName);

// --- Test Execution ---

async function runSmallImageTest() {
  console.log('Starting test for processWebtoonImage (small image)...');

  try {
    // Call the main processing function for small image
    const ankiPackageBuffer = await processWebtoonImage(
      mockImagePath,
      mockOcrApiKey,
      sourceLang,
      targetLang
    );

    console.log(`Received Anki package buffer with size: ${ankiPackageBuffer.byteLength} bytes.`);

    // Ensure the output directory exists
    if (!await fs.stat(outputDir).then(stat => stat.isDirectory()).catch(() => false)) { // Use async fs
      await fs.mkdir(outputDir, { recursive: true }); // Use async fs
    }

    // Save the Anki package buffer to a file
    await fs.writeFile(outputFilePath, new Uint8Array(ankiPackageBuffer)); // Use async fs

    console.log(`Successfully saved Anki package to ${outputFilePath}`);

  } catch (error: any) {
    console.error('Small image test failed:', error.message);
    console.error(error);
  }

  console.log('Small image test finished.');
}

async function runLargeImageTest() {
  console.log('Starting test for processWebtoonImage (large image)...');

  try {
    // Call the main processing function for large image
    const ankiPackageBuffer = await processWebtoonImage(
      mockLargeImagePath,
      mockOcrApiKey,
      sourceLang,
      targetLang
    );

    console.log(`Received Anki package buffer with size: ${ankiPackageBuffer.byteLength} bytes.`);

    // Ensure the output directory exists
    if (!await fs.stat(outputDir).then(stat => stat.isDirectory()).catch(() => false)) { // Use async fs
      await fs.mkdir(outputDir, { recursive: true }); // Use async fs
    }

    // Save the Anki package buffer to a file
    await fs.writeFile(outputLargeFilePath, new Uint8Array(ankiPackageBuffer)); // Use async fs

    console.log(`Successfully saved Anki package for large image to ${outputLargeFilePath}`);

  } catch (error: any) {
    console.error('Large image test failed:', error.message);
    console.error(error);
  }

  console.log('Large image test finished.');
}

// Execute the test functions
(async () => {
  await runSmallImageTest();
  await runLargeImageTest();
})(); 