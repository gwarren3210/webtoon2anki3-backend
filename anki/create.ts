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
        const data = JSON.parse(body);
        const translatedWordInfos =  data.translated_word_infos;
        const config = data.config;

        if (!translatedWordInfos || !Array.isArray(translatedWordInfos)) {
          throw new Error('Invalid request format: translated_word_infos must be an array');
        }

        const ankiPackageBuffer = await handleAnkiPackageCreation(translatedWordInfos, config);
        
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