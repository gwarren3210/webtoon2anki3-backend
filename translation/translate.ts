import { api } from "encore.dev/api";
import { IncomingMessage, ServerResponse } from "http";
import { PapagoTranslateEngine } from '../services/translation/papagoTranslateEngine';

export const translateEndpoint = api.raw(
  { expose: true, method: "POST", path: "/translate" },
  async (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text, sourceLang = 'ko', targetLang = 'en' } = JSON.parse(body);
        const translationEngine = new PapagoTranslateEngine(sourceLang, targetLang);
        const translatedText = await translationEngine.translateDeck(text);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(translatedText));
      } catch (error) {
        res.writeHead(500);
        res.end(`Translation failed: ${(error as Error).message}`);
      }
    });
  }
); 