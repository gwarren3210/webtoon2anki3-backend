import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
// import { Buffer } from "buffer";
import busboy from "busboy";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { processImageForOCR } from '../services/ocr-api';


/**
 * Processes an image file for OCR (Optical Character Recognition) and returns detected text with bounding boxes.
 * @param request - The raw HTTP request containing an image file
 * @param response - The HTTP response object
 * @returns JSON response with OCR results containing text and bounding boxes
 * 
 * The endpoint expects a POST request with a multipart form data containing an image file.
 * The image file should be sent as a file upload with the field name 'file'.
 * 
 * The response will be a JSON array of OCR results, each containing:
 * - text: The detected text
 * - bbox: A bounding box object with x, y, width, and height properties
 * 
 * Example response:
 * [
 *   {
 *     "text": "Hello",
 *     "bbox": { "x": 100, "y": 200, "width": 50, "height": 20 }
 *   }
 * ]
 */

export const ocrEndpoint = api.raw(
  { expose: true, method: "POST", path: "/ocr", bodyLimit: null },
  async (req: IncomingMessage, res: ServerResponse) => {
    let imageData: Uint8Array | null = null;
    const bb = busboy({ headers: req.headers, limits: { files: 1 } });

    bb.on("file", (_, file) => {
      const chunks: Uint8Array[] = [];
      file.on("data", (data) => chunks.push(data as Uint8Array))
          .on("close", () => {
            // Convert chunks to Uint8Array and concatenate
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              result.set(chunk, offset);
              offset += chunk.length;
            }
            imageData = result;
          });
    });

    bb.on("close", async () => {
      if (!imageData) {
        res.writeHead(400);
        res.end("No image file uploaded.");
        return;
      }

      try {
        const tempFileName = `ocr-image-${crypto.randomBytes(16).toString('hex')}.jpg`;
        const tempImagePath = path.join(os.tmpdir(), tempFileName);
        await fs.writeFile(tempImagePath, imageData);

        const ocrResults = await processImageForOCR(tempImagePath);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(ocrResults));

        await fs.unlink(tempImagePath);
      } catch (error) {
        res.writeHead(500);
        res.end(`OCR processing failed: ${(error as Error).message}`);
      }
    });

    req.pipe(bb);
  }
); 