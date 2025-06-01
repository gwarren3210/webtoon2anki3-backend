/**
 * Ensures the temporary directory exists.
 */
export declare function ensureTempDir(): Promise<void>;
/**
 * Saves a file buffer to the temporary directory.
 * @param filename - The name of the file
 * @param buffer - The file buffer
 * @returns The full path to the saved file
 */
export declare function saveTempFile(filename: string, buffer: Buffer): Promise<string>;
/**
 * Reads a file from the temporary directory.
 * @param filename - The name of the file
 * @returns The file buffer
 */
export declare function readTempFile(filename: string): Promise<Buffer>;
/**
 * Deletes a file from the temporary directory.
 * @param filename - The name of the file
 */
export declare function deleteTempFile(filename: string): Promise<void>;
