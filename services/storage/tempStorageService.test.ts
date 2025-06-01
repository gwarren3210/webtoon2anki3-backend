// @ts-ignore
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { saveTempFile, readTempFile, deleteTempFile, ensureTempDir } from './tempStorageService';

const TEMP_DIR = path.join(process.cwd(), 'tmp');
const TEST_FILE = 'testfile.txt';
const TEST_CONTENT = Buffer.from('hello world');

/**
 * Unit tests for tempStorageService
 */
describe('tempStorageService', () => {
  beforeAll(async () => {
    await ensureTempDir();
  });

  afterAll(async () => {
    try {
      await deleteTempFile(TEST_FILE);
    } catch {}
  });

  it('saves and reads a file', async () => {
    await saveTempFile(TEST_FILE, TEST_CONTENT);
    const data = await readTempFile(TEST_FILE);
    expect(data.equals(new Uint8Array(TEST_CONTENT))).toBe(true);
  });

  it('deletes a file', async () => {
    await saveTempFile(TEST_FILE, TEST_CONTENT);
    await deleteTempFile(TEST_FILE);
    await expect(readTempFile(TEST_FILE)).rejects.toThrow(/Failed to read temp file/);
  });

  it('throws error when reading non-existent file', async () => {
    await expect(readTempFile('no-such-file.txt')).rejects.toThrow(/Failed to read temp file/);
  });

  it('throws error when deleting non-existent file', async () => {
    await expect(deleteTempFile('no-such-file.txt')).rejects.toThrow(/Failed to delete temp file/);
  });
}); 