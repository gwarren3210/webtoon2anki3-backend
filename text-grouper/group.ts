import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
import { processAndGroupOcrResults } from '../services/text-grouper';

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