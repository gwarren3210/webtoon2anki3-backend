import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
import { Buffer } from "buffer";
import busboy from "busboy";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { URL } from 'url'; // Import URL to parse query parameters
import { processWebtoonImage } from './main';

// Define your raw endpoint
export const processImageEndpoint = api.raw(
  { 
   expose: true, 
   method: "POST",
   path: "/process-image",
   bodyLimit: null
  }, // Set bodyLimit to null for potentially large files
  async (req: IncomingMessage, res: ServerResponse) => {
    let imageData: Buffer | null = null;
    let tempImagePath: string | null = null;

    // Parse query parameters
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    const sourceLang = requestUrl.searchParams.get('sourceLang') || 'ko'; // Default to 'ko' if not provided
    const targetLang = requestUrl.searchParams.get('targetLang') || 'en'; // Default to 'en' if not provided

    const bb = busboy({
      headers: req.headers,
      limits: { files: 1 }, // Assuming only one image file is uploaded
    });

    bb.on("file", (_, file, info) => {
      const chunks: Buffer[] = [];
      file
        .on("data", (data) => {
          chunks.push(data);
        })
        .on("close", () => {
          imageData = Buffer.concat(chunks as unknown as Uint8Array[]);
          // Optionally, you can derive a more specific filename here based on info.filename
          // This is for the temporary input file name if needed, not the output .apkg name
        })
        .on("error", (err) => {
          bb.emit("error", err);
        });
    });

    bb.on("close", async () => {
      if (!imageData) {
        res.writeHead(400);
        res.end("No image file uploaded.");
        return;
      }

      try {
        // Save the image data to a temporary file
        const tempFileName = `uploaded-image-${crypto.randomBytes(16).toString('hex')}.jpg`; // Assuming JPG, adjust as needed
        tempImagePath = path.join(os.tmpdir(), tempFileName);
        await fs.writeFile(tempImagePath, imageData as unknown as Uint8Array);
        console.log(`Saved temporary image to ${tempImagePath}`);

        // *****************************************************
        // CALL THE processWebtoonImage FUNCTION
        // *****************************************************
        const ocrApiKey = process.env.OCR_API_KEY as string; // Get API key from environment variables
        if (!ocrApiKey) {
             console.warn("OCR_API_KEY environment variable not set.");
        }

        console.log(`Calling processWebtoonImage with temporary file: ${tempImagePath}, sourceLang: ${sourceLang}, targetLang: ${targetLang}`);
        const ankiPackageBuffer: ArrayBuffer = await processWebtoonImage(
          tempImagePath,
          ocrApiKey,
          sourceLang,
          targetLang
        );
        console.log('processWebtoonImage finished.');
        // *****************************************************
        // END OF CALL
        // *****************************************************

        // Set headers for file download
        const outputFilename = 'output.apkg'; // You might want to make this dynamic
        res.writeHead(200, {
          "Content-Type": "application/octet-stream", // MIME type for .apkg files
          "Content-Disposition": `attachment; filename="${outputFilename}"`,
          "Content-Length": Buffer.from(ankiPackageBuffer).length,
        });

        // Send the .apkg file content in the response
        res.end(Buffer.from(ankiPackageBuffer));

      } catch (processingErr) {
        console.error("Error during image processing pipeline:", processingErr);
        res.writeHead(500);
        res.end(`Error processing image: ${(processingErr as Error).message}`);
      } finally {
        // Clean up the temporary image file
        if (tempImagePath) {
          try {
            await fs.unlink(tempImagePath);
            console.log(`Deleted temporary image file: ${tempImagePath}`);
          } catch (cleanupErr) {
            console.error(`Error deleting temporary image file ${tempImagePath}:`, cleanupErr);
            // Continue despite cleanup error
          }
        }
      }
    });

    bb.on("error", (err) => {
      console.error("Error during file upload parsing:", err);
      res.writeHead(500);
      res.end(`File upload error: ${(err as Error).message}`);
    });

    req.pipe(bb);
  }
);
