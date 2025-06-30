import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
import { processAndGroupOcrResults } from '../services/text-grouper';
import { getDialogueFromGroupedText } from "../services/text-grouper";

/**
 * Groups OCR results into text lines based on vertical proximity.
 * @param request - The raw HTTP request containing OCR results
 * @param response - The HTTP response object
 * @returns JSON response with grouped text lines and their bounding boxes
 * 
 * The endpoint expects a POST request with a JSON body containing an array of OCR results.
 * Each OCR result should have a text field and a bbox field with x, y, width, and height properties.
 * 
 * Example request body:
 * [
 *   {
 *     "text": "Hello",
 *     "bbox": { "x": 100, "y": 200, "width": 50, "height": 20 }
 *   }
 * ]
 * 
 * The response will be a JSON array of grouped text lines, each containing:
 * - line: The combined text of the group
 * - bbox: The bounding box encompassing all text in the group
 */


export const groupTextEndpoint = api.raw(
  { expose: true, method: "POST", path: "/group-text" },
  async (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const ocrResults = JSON.parse(body);
        const groupedText = processAndGroupOcrResults(ocrResults);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(groupedText));
      } catch (error) {
        res.writeHead(500);
        res.end(`Text grouping failed: ${(error as Error).message}`);
      }
    });
  }
); 

/**
 * Extracts dialogue text from grouped OCR results.
 * @param request - The request containing grouped text data
 * @returns Array of strings containing only the dialogue text with line breaks
 */



/**
 * Encore can't import types from outside of the service. TODO: refactor into one service.
 */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type OcrLineResult = {
  line: string;
  bbox: BoundingBox;
};

interface GetDialogueRequest {
  groupedTextData: OcrLineResult[];
}

interface GetDialogueResponse {
  dialogueLines: string[];
}
export const getDialogue = api(
    { 
        method: "POST",
        expose: true,
        path: "/get-dialogue"
    },
    async (request: GetDialogueRequest): Promise<GetDialogueResponse> => {
        const dialogueLines = getDialogueFromGroupedText(request.groupedTextData);
        return { dialogueLines };
    }
); 