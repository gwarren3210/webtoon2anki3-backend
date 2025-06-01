import fs from 'fs/promises';
import path from 'path';

const TEMP_DIR = path.join(process.cwd(), 'tmp');

/**
 * Ensures the temporary directory exists.
 */
export async function ensureTempDir(): Promise<void> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (err) {
    throw new Error('Failed to create temp directory: ' + (err as Error).message);
  }
}

/**
 * Saves a file buffer to the temporary directory.
 * @param filename - The name of the file
 * @param buffer - The file buffer
 * @returns The full path to the saved file
 */
export async function saveTempFile(filename: string, buffer: Buffer): Promise<string> {
  try {
    await ensureTempDir();
    const filePath = path.join(TEMP_DIR, filename);
    await fs.writeFile(filePath, new Uint8Array(buffer));
    return filePath;
  } catch (err) {
    throw new Error('Failed to save temp file: ' + (err as Error).message);
  }
}

/**
 * Reads a file from the temporary directory.
 * @param filename - The name of the file
 * @returns The file buffer
 */
export async function readTempFile(filename: string): Promise<Buffer> {
  try {
    const filePath = path.join(TEMP_DIR, filename);
    return await fs.readFile(filePath);
  } catch (err) {
    throw new Error('Failed to read temp file: ' + (err as Error).message);
  }
}

/**
 * Deletes a file from the temporary directory.
 * @param filename - The name of the file
 */
export async function deleteTempFile(filename: string): Promise<void> {
  try {
    const filePath = path.join(TEMP_DIR, filename);
    await fs.unlink(filePath);
  } catch (err) {
    throw new Error('Failed to delete temp file: ' + (err as Error).message);
  }
} 