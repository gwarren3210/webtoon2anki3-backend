import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
// import { Buffer } from "buffer";
import busboy from "busboy";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { processImageForOCR } from '../services/ocr-api';

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

        // TODO: figure out API thing
        const ocrApiKey = process.env.OCR_API_KEY || 'helloworld';
        if (!ocrApiKey) {
          console.warn("OCR_API_KEY not configured");
        }

        const ocrResults = await processImageForOCR(tempImagePath, ocrApiKey);
        
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