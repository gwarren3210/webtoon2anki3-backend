import { api } from 'encore.dev/api';
import { TranslatedWordInfo } from '../services/types';
import { createAnkiPackage as createPackage } from '../services/anki/ankiPackageHandler';
import log from 'encore.dev/log';
import { IncomingMessage, ServerResponse } from 'http';

interface CreateAnkiPackageRequest {
  translatedWordInfos: TranslatedWordInfo[];
  deckName: string;
  config: {
    front_fields: string[];
    back_fields: string[];
    create_duplicate: boolean;
  };
}

/**
 * Creates an Anki package from translated word information.
 * 
 * @param req - The incoming HTTP request
 * @param res - The server response
 */
export const createAnkiPackage = api.raw(
  { expose: true, method: "POST", path: "/create-anki-package" },
  async (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    
    req.on('end', async () => {
      try {
        const request: CreateAnkiPackageRequest = JSON.parse(body);
        // Validate required fields
        if (!request.translatedWordInfos || !Array.isArray(request.translatedWordInfos)) {
          throw new Error('translatedWordInfos must be a non-empty array');
        }
        if (!request.deckName || typeof request.deckName !== 'string') {
          throw new Error('deckName must be a non-empty string');
        }
        
        log.info('Received request to create Anki package', {
          wordCount: request.translatedWordInfos.length,
          name: request.deckName,
          config: request.config
        });

        const ankiPackage = await createPackage(request.translatedWordInfos, request.deckName, request.config);
        
        log.info('Successfully created Anki package', {
          packageSize: ankiPackage.byteLength
        });

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="output.apkg"',
          'Content-Length': Buffer.from(ankiPackage).length
        });
        res.end(Buffer.from(ankiPackage));
      } catch (error) {
        log.error('Failed to create Anki package', {
          error: error instanceof Error ? error.message : String(error)
        });
        res.writeHead(500);
        res.end(`Anki package creation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }
); 