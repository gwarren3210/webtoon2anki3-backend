import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
import { handleAnkiPackageCreation } from '../services/anki/ankiPackageHandler';

export const createAnkiPackageEndpoint = api.raw(
  { expose: true, method: "POST", path: "/create-anki-package" },
  async (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const translatedWordInfos = JSON.parse(body);
        const ankiPackageBuffer = await handleAnkiPackageCreation(translatedWordInfos);
        
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="output.apkg"',
          "Content-Length": Buffer.from(ankiPackageBuffer).length,
        });
        res.end(Buffer.from(ankiPackageBuffer));
      } catch (error) {
        res.writeHead(500);
        res.end(`Anki package creation failed: ${(error as Error).message}`);
      }
    });
  }
); 