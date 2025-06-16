import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
import { processAndGroupOcrResults } from '../services/text-grouper';
import { getDialogueFromGroupedText } from "../services/text-grouper";
import { GetDialogueRequest, GetDialogueResponse } from "../services/types";


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