/**
 * Endpoint handler for processing images and storing vocabulary.
 * Combines OCR, AI vocabulary extraction, and database storage.
 *
 * Uses api.raw() because Encore typed APIs don't support multipart form data.
 * Error handling uses APIError for consistency with other endpoints.
 */

import { api, APIError } from 'encore.dev/api';
import { IncomingMessage, ServerResponse } from 'http';
import { Buffer } from 'buffer';
import busboy from 'busboy';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { URL } from 'url';
import log from 'encore.dev/log';

import { extractVocabularyFromImage } from '../services/imageVocabularyProcessor';
import {
  getSeriesIdBySlug,
  createChapter,
  insertNewVocabulary,
  linkVocabularyToChapter,
  getChapterStats
} from '../supabase/vocabularyHandler';
import type { ProcessImageAndStoreResponse } from '../services/types';

/**
 * Processes an image, extracts vocabulary via AI, and stores in database.
 *
 * @remarks
 * This is a raw endpoint because it handles multipart form data for image upload.
 * Encore's typed API doesn't support multipart, so api.raw() is required.
 *
 * @param series_slug - Series identifier (query param, required)
 * @param chapter_number - Chapter number (query param, required)
 * @param user_id - User ID for future features (query param, required)
 * @param chapter_title - Optional chapter title (query param)
 * @returns JSON with newWordsInserted, totalWordsInChapter, seriesSlug, chapterNumber
 */
export const processImageAndStoreEndpoint = api.raw(
  {
    expose: true,
    method: 'POST',
    path: '/process-image-and-store',
    bodyLimit: null
  },
  async (req: IncomingMessage, res: ServerResponse) => {
    let tempImagePath: string | null = null;

    try {
      // Parse and validate query parameters
      const params = parseAndValidateQueryParams(req);

      log.info('Processing image and store request', {
        seriesSlug: params.seriesSlug,
        chapterNumber: params.chapterNumber,
        userId: params.userId
      });

      // Parse multipart form data and save image to temp file
      const { tempImagePath: imagePath } = await parseMultipartImage(req);
      tempImagePath = imagePath;

      // Execute processing pipeline
      const response = await processImagePipeline(
        tempImagePath,
        params.seriesSlug,
        params.chapterNumber,
        params.chapterTitle
      );

      log.info('Successfully processed image and stored vocabulary', response);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      handleEndpointError(error, res);
    } finally {
      await cleanupTempFile(tempImagePath);
    }
  }
);

// =============================================================================
// Helper Types
// =============================================================================

interface QueryParams {
  seriesSlug: string;
  chapterNumber: number;
  userId: string;
  chapterTitle?: string;
}

interface ParsedImage {
  tempImagePath: string;
  mimetype: string;
}

// =============================================================================
// Query Parameter Parsing
// =============================================================================

/**
 * Parses and validates required query parameters.
 * @param req - Incoming HTTP request.
 * @returns Validated query parameters.
 * @throws APIError.invalidArgument if required params are missing or invalid.
 */
function parseAndValidateQueryParams(req: IncomingMessage): QueryParams {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);

  const seriesSlug = requestUrl.searchParams.get('series_slug');
  const chapterNumberStr = requestUrl.searchParams.get('chapter_number');
  const userId = requestUrl.searchParams.get('user_id');
  const chapterTitle =
    requestUrl.searchParams.get('chapter_title') || undefined;

  if (!seriesSlug) {
    throw APIError.invalidArgument('series_slug query parameter is required');
  }
  if (!chapterNumberStr) {
    throw APIError.invalidArgument(
      'chapter_number query parameter is required'
    );
  }
  if (!userId) {
    throw APIError.invalidArgument('user_id query parameter is required');
  }

  const chapterNumber = parseInt(chapterNumberStr, 10);
  if (isNaN(chapterNumber)) {
    throw APIError.invalidArgument('chapter_number must be a valid number');
  }

  return { seriesSlug, chapterNumber, userId, chapterTitle };
}

// =============================================================================
// Processing Pipeline
// =============================================================================

/**
 * Executes the main processing pipeline.
 * @param tempImagePath - Path to temporary image file.
 * @param seriesSlug - Series slug identifier.
 * @param chapterNumber - Chapter number.
 * @param chapterTitle - Optional chapter title.
 * @returns Processing response with stats.
 */
async function processImagePipeline(
  tempImagePath: string,
  seriesSlug: string,
  chapterNumber: number,
  chapterTitle?: string
): Promise<ProcessImageAndStoreResponse> {
  // 1. Lookup series_id from slug
  const seriesId = await getSeriesIdBySlug(seriesSlug);

  // 2. Extract vocabulary from image (OCR + Gemini)
  const vocabResult = await extractVocabularyFromImage(tempImagePath);

  // 3. Create chapter record
  const chapterId = await createChapter(seriesId, chapterNumber, chapterTitle);

  // 4. Insert vocabulary (skip existing terms)
  const { allVocabulary, newWordsInserted } = await insertNewVocabulary(
    vocabResult.words
  );

  // 5. Link vocabulary to chapter with importance scores
  await linkVocabularyToChapter(chapterId, allVocabulary, vocabResult.words);

  // 6. Get final stats
  const stats = await getChapterStats(chapterId);

  return {
    newWordsInserted,
    totalWordsInChapter: stats.totalWordsInChapter,
    seriesSlug: stats.seriesSlug,
    chapterNumber: stats.chapterNumber
  };
}

// =============================================================================
// Multipart Parsing
// =============================================================================

/**
 * Parses multipart form data to extract image file.
 * @param req - Incoming HTTP request.
 * @returns Promise resolving to temp file path and mimetype.
 * @throws APIError.invalidArgument if no image is uploaded.
 */
function parseMultipartImage(req: IncomingMessage): Promise<ParsedImage> {
  return new Promise((resolve, reject) => {
    let imageData: Buffer | null = null;
    let mimetype = 'image/jpeg';

    const bb = busboy({
      headers: req.headers,
      limits: { files: 1 }
    });

    bb.on('file', (fieldname: string, stream: any, info: any) => {
      mimetype = info.mimeType || 'image/jpeg';
      const chunks: Uint8Array[] = [];

      stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      stream.on('end', () => {
        imageData = Buffer.concat(chunks);
      });
      stream.on('error', (err: Error) => {
        reject(APIError.internal('File stream error').withDetails({
          error: err.message
        }));
      });
    });

    bb.on('close', async () => {
      if (!imageData) {
        reject(APIError.invalidArgument('No image file uploaded'));
        return;
      }

      try {
        const ext = getFileExtension(mimetype);
        const tempFileName = `vocab-image-${crypto.randomBytes(16).toString('hex')}${ext}`;
        const tempImagePath = path.join(os.tmpdir(), tempFileName);
        await fs.writeFile(tempImagePath, new Uint8Array(imageData));

        log.info('Saved temp image', {
          tempImagePath,
          size: imageData.length,
          mimetype
        });

        resolve({ tempImagePath, mimetype });
      } catch (err) {
        reject(APIError.internal('Failed to save uploaded image').withDetails({
          error: err instanceof Error ? err.message : String(err)
        }));
      }
    });

    bb.on('error', (err: Error) => {
      reject(APIError.internal('Multipart parsing error').withDetails({
        error: err.message
      }));
    });

    req.pipe(bb);
  });
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Handles endpoint errors and sends appropriate HTTP response.
 * @param error - The error to handle.
 * @param res - HTTP response object.
 */
function handleEndpointError(error: unknown, res: ServerResponse): void {
  log.error('Error processing image and storing vocabulary', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });

  if (error instanceof APIError) {
    const statusCode = getHttpStatusFromAPIError(error);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: error.message,
      code: error.code,
      details: error.details
    }));
    return;
  }

  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: error instanceof Error ? error.message : 'Internal server error',
    code: 'internal'
  }));
}

/**
 * Maps APIError to HTTP status code.
 * @param error - The APIError instance.
 * @returns HTTP status code.
 */
function getHttpStatusFromAPIError(error: APIError): number {
  switch (error.code) {
    case 'invalid_argument':
      return 400;
    case 'not_found':
      return 404;
    case 'already_exists':
      return 409;
    case 'permission_denied':
      return 403;
    case 'unauthenticated':
      return 401;
    default:
      return 500;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Cleans up temporary image file.
 * @param tempImagePath - Path to temp file, or null if none exists.
 */
async function cleanupTempFile(tempImagePath: string | null): Promise<void> {
  if (!tempImagePath) return;

  try {
    await fs.unlink(tempImagePath);
    log.info('Deleted temp image file', { tempImagePath });
  } catch (err) {
    log.error('Failed to delete temp file', {
      tempImagePath,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * Gets file extension from MIME type.
 * @param mimetype - The MIME type string.
 * @returns File extension including dot.
 */
function getFileExtension(mimetype: string): string {
  const mimeToExt: { [key: string]: string } = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  return mimeToExt[mimetype] || '.jpg';
}
