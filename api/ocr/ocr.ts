import { api } from "encore.dev/api";
import { runPaddleOcr, OcrResult } from "../../services/ocr/paddleOcrService";

/**
 * Request type for OCR endpoint.
 */
export interface OcrRequest {
  /** Absolute path to the image file to process */
  imagePath: string;
}

/**
 * POST /api/ocr/ocr
 * Runs OCR on the provided image using PaddleOCR (TypeScript implementation).
 * No authentication required.
 * @param req - OcrRequest
 * @returns OcrResult
 */
export const ocr = api<OcrRequest, OcrResult>(
  { method: "POST", expose: true, path: "/api/ocr/ocr" },
  async (req: OcrRequest): Promise<OcrResult> => {
    // Orchestrate OCR (no logic here)
    return await runPaddleOcr(req.imagePath);
  }
); 