import { SmartOCRProcessor, OCRConfig } from './smartOcrProcessor';
import { OcrResult } from '../types';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Quick function for simple OCR processing.
 * Returns an array of OcrResult objects on success, throws error on failure.
 */
export async function processImageForOCR(
    input: string | Buffer, 
    apiKey: string,
    options: Partial<OCRConfig> = {}
): Promise<OcrResult[]> {
   console.log("Entered processImageForOCR")
    if (!apiKey) {
        apiKey = process.env.OCR_API_KEY as string;
        if (!apiKey) {
            throw new Error('OCR API key not provided and not found in environment variables');
        }
    }
    const processor = new SmartOCRProcessor({ apiKey, ...options });
    return await processor.processImage(input); // processImage handles file vs buffer
}

/**
 * Batch OCR processing with smart tiling.
 * Returns an array of results, where each result includes filename and OcrResult[] or error.
 * Note: this is of low priority as it is not used in the project.
 */
export async function batchOCRProcessing(
    inputDir: string,
    apiKey: string,
    outputDir?: string
): Promise<{ filename: string; result?: OcrResult[]; error?: string }[]> {
    const processor = new SmartOCRProcessor({ apiKey });
    const results: { filename: string; result?: OcrResult[]; error?: string }[] = [];

    try {
        // TODO: Add file type filtering based on supported image types by OCR.space
        const files = await fs.readdir(inputDir);
        const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png|bmp|gif|tiff?)$/i.test(file) // Keep basic image filter for now
        );

        console.log(`Processing ${imageFiles.length} images for OCR...`);

        for (const filename of imageFiles) {
            const inputPath = path.join(inputDir, filename);
            console.log(`\nProcessing ${filename}...`);

            try {
                // processImage can handle the file path directly
                const ocrResults = await processor.processImage(inputPath);
                 results.push({ filename, result: ocrResults });

                // Save text output if directory provided
                if (outputDir && ocrResults.length > 0) {
                    await fs.mkdir(outputDir, { recursive: true });
                    const textFilename = path.parse(filename).name + '.txt';
                    const textPath = path.join(outputDir, textFilename);
                     // Join text from all OcrResult objects for the output file
                    const combinedText = ocrResults.map(r => r.text).join('\n');
                    await fs.writeFile(textPath, combinedText, 'utf8');
                    console.log(`Saved OCR text to ${textPath}`);
                }

                console.log(`✓ Success: Extracted ${ocrResults.length} text elements.`);

            } catch (error: any) {
                console.error(`✗ Failed for ${filename}: ${error.message}`);
                results.push({ filename, error: error.message });
            }

            // Rate limiting delay
            // Assuming delay is imported or accessible if needed directly
            // await processor['delay'](500); // Use delay from processor instance
        }

    } catch (error: any) {
        console.error('Batch processing error:', error.message);
         // Optionally, re-throw or return an error for the batch operation itself
        // throw error;
    }

    return results;
} 