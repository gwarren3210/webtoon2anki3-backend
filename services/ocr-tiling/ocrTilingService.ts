import { OcrResult } from './types';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import os from 'os';

/**
 * Runs OCR on an image by calling the Python OCR pipeline script.
 * Saves the image to a temporary file, passes the path to the Python script,
 * and parses the JSON output from stdout.
 * @param image - The image buffer.
 * @returns Promise resolving to an array of unique OCR results.
 */
export async function runOcrWithTiling(
  image: Buffer
): Promise<OcrResult[]> {
  const tempDir = os.tmpdir();
  const uniqueId = randomUUID();
  const tempImagePath = path.join(tempDir, `upload_${uniqueId}.png`);

  try {
    await fs.writeFile(tempImagePath, image);
    console.log(`Saved temporary image to ${tempImagePath}`);

    const pythonProcess = spawn('python', ['backend/python/ocr/ocr_pipeline.py', tempImagePath]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error(`Python process failed with code ${code}`);
          console.error(`Stderr: ${stderrData}`);
          return reject(new Error(`OCR pipeline failed. Stderr: ${stderrData}`));
        }

        try {
          const results: OcrResult[] = JSON.parse(stdoutData);
          console.log("Successfully parsed OCR results from Python.");
          resolve(results);
        } catch (parseError) {
          console.error("Failed to parse JSON from Python stdout:", parseError);
          console.error(`Stdout: ${stdoutData}`);
          console.error(`Stderr: ${stderrData}`);
          reject(new Error(`Failed to parse OCR results. Stdout: ${stdoutData}`));
        }
      });

      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        reject(new Error(`Failed to start OCR pipeline process: ${err.message}`));
      });
    });

  } finally {
    try {
      await fs.unlink(tempImagePath);
      console.log(`Cleaned up temporary image file ${tempImagePath}`);
    } catch (cleanupError) {
      console.error(`Failed to clean up temporary image file ${tempImagePath}:`, cleanupError);
    }
  }
} 